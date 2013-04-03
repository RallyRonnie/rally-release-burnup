function makeIsoDate(initial_date,record) {
    //window.console && console.log( initial_date, typeof(initial_date));
    if ( typeof(initial_date) === "string" ) {
        return initial_date;
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false);
 }
 
 Ext.define('Rally.pxs.data.IterationDataModel',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'IsoEndDate',type:'string',convert:makeIsoDate,defaultValue: new Date() },
        {name:'Name',type:'string',defaultValue: "Iteration" },
        {name:'temp',type:'int',defaultValue: 1 }
    ]
});