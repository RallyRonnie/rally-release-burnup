/*
 * A burn up chart for the stories in a release, showing planned and accepted by iteration.
 * 
 * NOTES:
 * ** This is about planning forward:
 * ** The data is taken from when the report is run (does not use the lookback api).  That is, a point is counted
 * as accepted for a sprint if right at this moment it is associated with a sprint and is accepted.  The planned line does
 * not look back to what the initial or intermediate planning was.  So, if you move an item from one sprint to another,
 * the chart will no longer show that it was planned for the other.  If you copy or split, it will show up as planned
 * in the original, but then your acceptance will never converge to scope.
 * ** To show the chart broken down by team (and normalized), change "show_teams" to true
 */

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    version: "0.3",
    defaults: { margin: 5 },
    show_teams: true,
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'chart_box'},
        {xtype:'container',itemId:'notes',html:'This chart displays only sprints that contain artifacts associated with the chosen release'}
    ],
    selected_release: null,
    items_in_release: [],
    applied_state:null,
    launch: function() {
        this._addTimeboxSelector();
    },
    _addTimeboxSelector: function() {
        var me = this;
        this.down('#selector_box').add({
            xtype:'rallyreleasecombobox',
            itemId:'release_box',
            stateId: 'pxs.burnup.release',
            stateful: true,
            stateEvents: ['change'],
            getState: function() {
                window.console && console.log( ".......saving state", this.getRawValue() );
                return { value: this.getRawValue() };
            },
            applyState: function(state) {
                window.console && console.log(".......applying state", state);
                if ( state && state.value ) {
                    me.applied_state = state.value;
                    //this.setRawValue(state.value);
                }
            },
            listeners: {
                change: function(rb,newValue,oldValue) {
                    this.selected_release = rb.getRecord();
                    this._getScopedReleases();
                },
                ready: function(rb) {
                    window.console && console.log( ".......release ready", this.applied_state );
                    // applyState (above) seems to work before the data is loaded
                    if (this.applied_state) {
                        window.console && console.log(".......re-applying state", this.applied_state);
                        var same_release = rb.findRecordByDisplay(this.applied_state);
                        if ( same_release ) {
                            rb.setValue(same_release);
                        }
                    }
                    this.selected_release = rb.getRecord();
                    this._getScopedReleases();
                },
                scope: this
            }
        });
    },
    _getScopedReleases: function() {
        var me = this;
        this.release_oids = [];
        if(this.chart){this.chart.destroy();}
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Release',
            autoLoad: true,
            filters: {property:'Name',value:me.selected_release.get('Name')},
            listeners: {
                load: function(store,data,success){
                    Ext.Array.each(data,function(item){
                        me.release_oids.push(item.get('ObjectID'));
                    });
                    //me._getIterationsInRange(me.selected_release.get('ReleaseStartDate'),me.selected_release.get('ReleaseDate'));
                    me._getIterations();
                }
            }
        });
    },
    _getIterations: function(){
        var me = this;
        this.iterations = {};
        this.team_names = {}; // key is team objectid
        this.team_data = {}; // key will be team objectid
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Iteration',
            autoLoad: true,
            sorters: [{ property: 'StartDate' } ],
            listeners: {
                load: function(store,data,success){
                    Ext.Array.each(data,function(item){
                        me.team_names[item.get('Project').ObjectID] = item.get('Project').Name;
                        me.team_data[item.get('Project').ObjectID] = {};
                        if (!me.iterations[item.get('Name')]) {
                            me.iterations[item.get('Name')] = [];
                        }
                        me.iterations[item.get('Name')].push(item);
                    });
                    me._getItemsInRelease();
                },
                scope: this
            }
        });
    },
    _getIterationsInRange: function(start_date, end_date){
        var me = this;
        this.iterations = {};
        var start_date_iso = Rally.util.DateTime.toIsoString(start_date);
        var end_date_iso = Rally.util.DateTime.toIsoString(end_date);
        var start_filter = Ext.create('Rally.data.QueryFilter',{property:'StartDate',operator:'>=',value:start_date_iso}).and(
            Ext.create('Rally.data.QueryFilter',{property:'StartDate',operator:'<=',value:end_date_iso}));
        var end_filter = Ext.create('Rally.data.QueryFilter',{property:'EndDate',operator:'>=',value:start_date_iso}).and(
            Ext.create('Rally.data.QueryFilter',{property:'EndDate',operator:'<=',value:end_date_iso}));

        var filters = start_filter.or(end_filter);
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Iteration',
            autoLoad: true,
            filters: filters,
            sorters: [{ property: 'StartDate' } ],
            listeners: {
                load: function(store,data,success){
                    Ext.Array.each(data,function(item){
                        if (!me.iterations[item.get('Name')]) {
                            me.iterations[item.get('Name')] = [];
                        }
                        me.iterations[item.get('Name')].push(item);
                    });
                    me._getItemsInRelease();
                },
                scope: this
            }
        });
    },
    _getItemsInRelease: function() {
        window.console && console.log("_getItemsInRelease");
        var me = this;
        this.item_store = Ext.create('Rally.data.WsapiDataStore',{
            model: 'UserStory',
            autoLoad: true,
            filters: {property:'Release.Name',operator:'=',value:me.selected_release.get('Name')},
            fetch:['PlanEstimate','ScheduleState','Iteration','Name','Project','ObjectID'],
            listeners: {
                load: function(store,data,success){
                    this.items_in_release = data;
                    this._makeIterationSlices();
                },
                scope: this
            }
        });
    },
    _getEndDates: function(iteration_hash) {
        var date_array = [];
        for (var i in iteration_hash ) {
            if ( iteration_hash.hasOwnProperty(i) ) {
                date_array.push(iteration_hash[i][0].get('EndDate'));
            }
        }
        return date_array;
    },
    _makeIterationSlices: function() {
        window.console && console.log( "_makeIterationSlices");
        var data_hash = {}; // key will be name
        for ( var name in this.iterations ) {
            var end_date = this.iterations[name][0].get('EndDate');
            var start_date = this.iterations[name][0].get('StartDate');

            data_hash[name] = Ext.create('Rally.pxs.data.IterationDataModel', { 
                Name: name, 
                IsoEndDate: end_date,
                IsoStartDate: start_date
            });
        }
        // add points from stories
        if ( this.items_in_release.length === 0 ) {
            this.chart = this.down('#chart_box').add({xtype:'container',html:'No data found.'});
        } else {
            Ext.Array.each(this.items_in_release,function(record){
                if ( record.get('Iteration') ) {
                    var sprint = record.get('Iteration').Name;
                    var project_oid = record.get('Project').ObjectID;
                    window.console && console.log( project_oid );
                    if ( ! this.team_data[project_oid][name] ) {
                        this.team_data[project_oid][name] = Ext.create('Rally.pxs.data.IterationDataModel', { 
                            Name: name, 
                            IsoEndDate: end_date,
                            IsoStartDate: start_date
                        });
                    }
            
                    if ( data_hash[sprint] ) {
                        data_hash[sprint].addScheduledItem(record.getData());
                    } else { 
                        window.console && console.log("WARNING: Iteration not defined",sprint);
                    }
                } else {
                    window.console && console.log("WARNING: Item not in sprint", record );
                }
            });
            data_hash = this._calculateCumulativeData(data_hash);
            this._showChart(data_hash);
        }
    },
    _calculateCumulativeData: function(data_hash) {
        var total_points = 0;
        var total_accepted = 0;
        for ( var sprint in data_hash ) {
            if ( data_hash.hasOwnProperty(sprint) ) {
                total_points += data_hash[sprint].get('PointsPlanned');
                total_accepted += data_hash[sprint].get('PointsAccepted');
                data_hash[sprint].set('CumulativePointsPlanned', total_points);
                data_hash[sprint].set('CumulativePointsAccepted', total_accepted);
            }
        }
        return data_hash;
    },
    _getCurrentSprintIndex: function(data_array) {
        var index = -1;
        Ext.Array.each(data_array, function(sprint,counter) {
            if(sprint && sprint.TemporalState === "Current" ) {
                index = counter;
            }
        });
        return index;
    },
    _setTrend: function(sprints,scope) {
        // Use Linear Least Squares: it assumes x is good and error is concentrated in Y values
        window.console && console.log("_setTrend");
        var me = this;
        var velocity_array = [];
        var x_array = [];
        var got_one = false;
        Ext.Array.each(sprints,function(sprint,index){
            if ( sprint.TemporalState !== "Future") {
                // drop leading zeroes
                if ( got_one || sprint.CumulativePointsAccepted > 0 ) {
                    got_one = true;
                    x_array.push(index);
                    velocity_array.push(sprint.CumulativePointsAccepted);
                }
            }
        });
        window.console && console.log( velocity_array );
        if ( velocity_array.length < 3 ) { 
            return sprints;
        }
        var sum_x = 0;
        var sum_y = 0;
        var sum_xy = 0;
        var sum_xx = 0;

        var number_of_points = velocity_array.length;
        sum_x = Ext.Array.sum(x_array);
        sum_y = Ext.Array.sum(velocity_array);
        Ext.Array.each(x_array, function(x,index){
            sum_xy += x*velocity_array[index];
            sum_xx += x*x;
        });
        // y = ax + b
        var a = (number_of_points*sum_xy - sum_x*sum_y) / (number_of_points*sum_xx - sum_x*sum_x);
        var b = (sum_y/number_of_points) - (a*sum_x)/number_of_points;
        Ext.Array.each(sprints,function(sprint,index){
            if (index>=x_array[0]) {
                if (a*index+b <= scope ) {
                    sprint.TrendPoint=me._limitDecimals(a*index + b);
                } else {
                    sprint.TrendPoint = scope;
                }
                
            } else {
                sprint.TrendPoint=null;
            }
        });
        
        if ( sprints[sprints.length-1].TrendPoint < scope ) {
            // we aren't going to make it in the planned set of sprints
            var MAX_EXTRA = 5;
            var added_counter = 1;
            var trend_point = 0;
            var start_point = sprints.length-1;
            while( added_counter <= MAX_EXTRA && trend_point <=scope ) {
                var x = start_point + added_counter;
                trend_point = me._limitDecimals(a*x + b);
                sprints.push({
                    Name:"+" + added_counter,
                    TrendPoint: trend_point,
                    CumulativePointsPlanned:null,
                    CumulativePointsAccepted:null,
                    TemporalState:"Future"
                });
                added_counter++;
            }
        }
        return sprints;
    },
    _showChart: function(data_hash){
        window.console && console.log("_showChart", data_hash, this.show_teams);
        if ( this.show_teams ) {
            this._showSegregatedChart();
        } else {
            this._showCombinedChart(data_hash);
        }
    },
    _showCombinedChart: function(data_hash) {
        var data_array = this._hashToArray(data_hash);
        var scope = data_array[data_array.length-1].CumulativePointsPlanned;
        data_array = this._setTrend(data_array,scope);
        
        var current_sprint_index = this._getCurrentSprintIndex(data_array);

        var chart_store = Ext.create('Ext.data.Store',{
            autoLoad: true,
            data: {data:data_array},
            model: 'Rally.pxs.data.IterationDataModel',
            proxy: {type: 'memory',reader: { type:'json',root:'data' } }
        });
        if(this.chart){this.chart.destroy();}
        this.chart = Ext.create('Rally.ui.chart.Chart',{
            height: 400,
            store: chart_store,
            series: [
                {type:'line',dataIndex:'CumulativePointsPlanned',name:'Points Planned',visible:true},
                {type:'line',dataIndex:'CumulativePointsAccepted',name:'Points Accepted',visible:true},
                {type:'column',dataIndex:'CumulativeDeviation',name:'Gap from Required',visible: true},
                {type:'line',dataIndex:'TrendPoint',name:'Trend',visible:true}],
            chartConfig: {
                title: {text:'Program Burn Up',align:'center'},
                colors: ['#696','#00f','#c33'],
                xAxis: {
                    categories: this._getIterationNames(data_array),
                    plotLines: [{color:'#000',width:2,value:current_sprint_index}]
                },
                yAxis: [{
                    title: { text:"" },
                    plotLines: [
                        {color:'#000',width:2,value:0},
                        {color:'#f00',width:2,value:scope}
                    ]
                }]
            }
        });
        this.down('#chart_box').add(this.chart);
    },
    _getIterationNames: function(object_array) {
        var string_array = [];
        Ext.Array.each( object_array, function(item){
            string_array.push(item.Name);
        });
        return string_array;
    },
    _hashToArray: function(hash) {
        var the_array = [];
        for (var key in hash ) {
            if (hash.hasOwnProperty(key)){
                // not sure why the model can't be pushed straight into the store
                if ( hash[key].get('PointsPlanned') && hash[key].get('PointsPlanned') > 0 ) {
                    the_array.push(hash[key].getData());
                }
            }
        }
        return the_array;
    },
    _limitDecimals: function(initial_value) {
        return parseInt( 10*initial_value, 10 ) / 10;
    }
    
});
