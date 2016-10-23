
var QuickLight = QuickLight || (function() {
    "use strict";
    
    // Version Number
    var this_version = 0.2;
    // Date: (Subtract 1 from the month component)
    var this_lastUpdate = new Date(2016, 9, 23, 18, 1);
    
    // Basic "torch" by setting all-player-visible light.
    function addTorch(token_o, enable) {
        if (enable) {
            token_o.set({
                light_radius: 40,
                light_dimradius: 20,
                light_otherplayers: true
            });
        }
        else {
            token_o.set({
                light_radius: "",
                light_dimradius: "",
                light_otherplayers: false
            });
        }
    }

    // Hanhdle yellow marker to toggle the light source.
    function onYellowMarker(obj, prev)
    {
        //log("status changed");
        var yellowIsOn = obj.get("status_yellow");
        var yellowWasOn = prev["statusmarkers"].includes("yellow");
        //log ("YIO " + yellowIsOn + " YWO " + yellowWasOn);
        if (!yellowWasOn && yellowIsOn) {
            //log("turning light on");
            addTorch(obj, true);
        }
        else if (yellowWasOn && !yellowIsOn) {
            //log("turning light off");
            addTorch(obj, false);
        }
    };
    
    function initialize()
    {
        log("-=> QuickLight v" + this_version + " <=-  [" + this_lastUpdate + "]");
        
        on("change:graphic:statusmarkers", onYellowMarker)
    }
    
    // Initialize.
    on("ready", initialize);
    
    return {
        initializeFunc : initialize
    };

}());

