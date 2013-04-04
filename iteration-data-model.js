function makeIsoDate(initial_date,record) {
    //window.console && console.log( initial_date, typeof(initial_date));
    if ( typeof(initial_date) === "string" ) {
        return initial_date;
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false);
 }
function makeShorterIsoDate(initial_date,record) {
    //window.console && console.log( initial_date, typeof(initial_date));
    if ( initial_date === null ) {
        initial_date = record.get('IsoEndDate');
    }
    if ( typeof(initial_date) === "string" ) {
        return initial_date.replace(/T.*$/,"");
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false).replace(/T.*$/,"");
 }
 
 Ext.define('Rally.pxs.data.IterationDataModel',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'IsoEndDate',type:'string',convert:makeIsoDate,defaultValue: new Date() },
        {name:'ShortIsoEndDate', type: 'string', convert: makeShorterIsoDate, defaultValue: null },
        {name:'Name',type:'string',defaultValue: "Iteration" },
        {name:'PointsPlanned',type:'float',defaultValue: 0 },
        {name:'PointsAccepted',type:'float',defaultValue: 0 },
        {name:'CumulativePointsPlanned',type:'float', defaultValue:0},
        {name:'CumulativePointsAccepted',type:'float',defaultValue:0}
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
    }
});