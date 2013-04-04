describe("Iteration Data Model Tests", function(){
    var today = new Date();
    var yesterday = Rally.util.DateTime.add(today,"day",-1);
    var tomorrow = Rally.util.DateTime.add(today,"day",1);
    var next_week = Rally.util.DateTime.add(today,"day",7);
    var last_week = Rally.util.DateTime.add(today,"day",-7);
    
    beforeEach(function() {
    //
    });

    it("should return default values", function(){
        var today = new Date();
        var today_iso_string = Rally.util.DateTime.toIsoString(today,false).replace(/T.*$/,"");
        var model = Ext.create('Rally.pxs.data.IterationDataModel',{});
        expect(model.get('IsoEndDate')).toMatch(new RegExp(today_iso_string)); // off by second 
        expect(model.get('IsoStartDate')).toMatch(new RegExp(today_iso_string)); // off by second 
        expect(model.get('Name')).toEqual("Iteration");
        expect(model.get('PointsAccepted')).toEqual(0);
        expect(model.get('PointsPlanned')).toEqual(0);
    });
    
    it("should return an iso date string when given an iso date string", function(){
        var today = new Date();
        var today_iso_string = Rally.util.DateTime.toIsoString(today,false).replace(/T.*$/,"");
        var model = Ext.create('Rally.pxs.data.IterationDataModel',{ 
            'IsoEndDate': '2012-12-01',
            'IsoStartDate': '2012-11-30' });
        expect(model.get('ShortIsoEndDate')).toEqual("2012-12-01");
        expect(model.get('IsoEndDate')).toMatch(new RegExp('2012-12-01')); 
        expect(model.get('ShortIsoStartDate')).toEqual("2012-11-30");
        expect(model.get('IsoStartDate')).toMatch(new RegExp('2012-11-30'));
    });
    
    it("should return a planned estimate when stories are added", function() {
        // TODO: this assumes Accepted is final state
        var item1 = { ScheduleState: "Accepted", PlanEstimate: 5 };
        var item2 = { ScheduleState: "Defined", PlanEstimate: 5 };
        var item3 = { ScheduleState: "Accepted" };
        var item4 = { PlanEstimate: 7 };
        var item5 = { };
        var model = Ext.create('Rally.pxs.data.IterationDataModel',{});
        model.addScheduledItem(item1);
        model.addScheduledItem(item2);
        model.addScheduledItem(item3);
        model.addScheduledItem(item4);
        model.addScheduledItem(item5);
        
        expect(model.get('PointsPlanned')).toEqual(17);
        expect(model.get('PointsAccepted')).toEqual(5);
    });
    
    it("should know if this is a future,past or current sprint",function(){
        var model = Ext.create('Rally.pxs.data.IterationDataModel',{
            IsoStartDate: last_week,
            IsoEndDate: next_week
        });
        expect(model.get('TemporalState')).toEqual("Current");
        
        model.set('IsoEndDate',yesterday);
        expect(model.get('TemporalState')).toEqual('Past');
        
        model.set('IsoEndDate',next_week);
        model.set('IsoStartDate',tomorrow);
        expect(model.get('TemporalState')).toEqual('Future');
    });
    
    it("should set cumulative flow unless sprint is in future", function(){
        var model = Ext.create('Rally.pxs.data.IterationDataModel',{
            IsoStartDate: last_week,
            IsoEndDate: next_week
        });
        model.set('CumulativePointsAccepted',5);
        expect(model.get('CumulativePointsAccepted')).toEqual(5);
        
        model.set('IsoStartDate',tomorrow);
        expect(model.get('CumulativePointsAccepted')).toEqual(null);
        
        model.set('CumulativePointsAccepted',5);
        expect(model.get('CumulativePointsAccepted')).toEqual(null);
    });
});