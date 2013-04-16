 function limitDecimals(initial_value) {
    return parseInt( 10*initial_value, 10 ) / 10;
 }
 
 function makeIsoDate(initial_date,record) {
    //window.console && console.log( initial_date, typeof(initial_date));
    if ( typeof(initial_date) === "string" ) {
        return initial_date;
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false);
}
 
function makeShorterIsoDate(initial_date) {
    if ( typeof(initial_date) === "string" ) {
        return initial_date.replace(/T.*$/,"");
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false).replace(/T.*$/,"");
}
 
function makeShorterEndDate(initial_date,record) {
    if ( initial_date === null ) {
        initial_date = record.get('IsoEndDate');
    }
    return makeShorterIsoDate(initial_date);
}
function makeShorterStartDate(initial_date,record) {
    if ( initial_date === null ) {
        initial_date = record.get('IsoStartDate');
    }
    return makeShorterIsoDate(initial_date);
 }

function setTemporalState(initial_value,record) {
    var today = new Date();
    var start = Rally.util.DateTime.fromIsoString( record.get('IsoStartDate') );
    var end = Rally.util.DateTime.fromIsoString( record.get('IsoEndDate') );
    
    var temporal_state = "Current";
    if ( start > end ) {
        temporal_state = "Reversed";
    } else if ( end < today ) {
        temporal_state = "Past";
    } else if ( start > today ) {
        temporal_state = "Future";
    }
    return temporal_state;
}
function convertCumulativeAccepted(initial_value,record) {
    if ( record.get('TemporalState') === "Future" ) {
        return null;
    } else {
        return initial_value;
    }
}
function convertCumulativeDeviation(initial_value,record) {
    if ( record.get('TemporalState') === "Future" ) {
        return null;
    } else {
        var planned = record.get('CumulativePointsPlanned') || 0;
        var accepted = record.get('CumulativePointsAccepted') || 0;
        
        return planned-accepted;
    }
}
 Ext.define('Rally.pxs.data.IterationDataModel',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'IsoEndDate',type:'string',convert:makeIsoDate,defaultValue: new Date() },
        {name:'ShortIsoEndDate', type: 'string', convert: makeShorterEndDate, defaultValue: null },
        {name:'IsoStartDate',type:'string',convert:makeIsoDate,defaultValue: new Date() },
        {name:'ShortIsoStartDate', type: 'string', convert: makeShorterStartDate, defaultValue: null },
        {name:'Name',type:'string',defaultValue: "Iteration" },
        {name:'PointsPlanned',type:'float',defaultValue: 0 },
        {name:'PointsAccepted',type:'float',defaultValue: 0 },
        {name:'CumulativePointsPlanned',type:'float', defaultValue:0},
        {name:'CumulativePointsAccepted',type:'float',defaultValue:0, convert:convertCumulativeAccepted},
        {name:'CumulativeDeviation',type:'float',defaultValue:0,convert: convertCumulativeDeviation},
        {name:'TemporalState',type:'string',defaultValue:'unknown',convert:setTemporalState},
        {name:'TrendPoint', type:'float',defaultValue: null, convert: limitDecimals }
    ],
    addScheduledItem: function(item) {
        if ( item.PlanEstimate ) {
            var current_accepted = this.get('PointsAccepted');
            var current_planned = this.get('PointsPlanned');
            var item_points = parseFloat(item.PlanEstimate,10);
            
            this.set('PointsPlanned',parseFloat(item_points) + current_planned );
            if ( item.ScheduleState && item.ScheduleState === "Accepted" ) {
                this.set('PointsAccepted',item_points + current_accepted );
            }
        }
    },
    set: function(field_name,new_value) {
        var me = this;
        var changed_fields = this.callParent([field_name,new_value]);
        if (changed_fields) {
            if ( Ext.Array.indexOf(changed_fields,"CumulativePointsPlanned") > -1 || Ext.Array.indexOf(changed_fields,"CumulativePointsAccepted") > -1 ){
                this.set('CumulativeDeviation', -1);
            }
            if ( Ext.Array.indexOf(changed_fields,"IsoEndDate") > -1 || Ext.Array.indexOf(changed_fields,"IsoStartDate") > -1 ){
                this.set('TemporalState', setTemporalState("",this));
                if ( this.get('TemporalState') === "Future" ) {
                    this.set('CumulativePointsAccepted',null);
                    this.set('CumulativeDeviation',null);
                }
            }
           
        }
        return changed_fields;
    }
});