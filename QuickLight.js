var QuickLight = QuickLight || (function() {
	"use strict";

	// Version Number
	var this_version = 0.3;
	// Date: (Subtract 1 from the month component)
	var this_lastUpdate = new Date(2016, 9, 23, 21, 55);
	// Verbose (print messages)
	var this_verbose = false;

	// Find the torch token corresponding to the specified token object.
	function findTorch(token_o)
	{
		// Search for the object in the state object.
		var torch = state.QuickLight.torches[token_o.id];
		return torch;
	};

	// Register a torch so it can be removed later.
	function registerTorch(token_o, torch_o)
	{
		// If there is an existing torch entry, delete the old token.
		var torch = state.QuickLight.torches[token_o.id];
		if (torch) {
			var oldTorch_o = getObj("graphic", torch.id);
			log("registerTorch: removing old torch w ID: " + torch.id);
			if (oldTorch_o) { oldTorch_o.remove(); }
		}

		// Present or not, we're going to replace the entry.
		state.QuickLight.torches[token_o.id] = {
			// ID of the torch object
			id : torch_o.id,
			// ID of the torch's owner
			owner : token_o.id
		};

		log("registerTorch(" + token_o.id + ", " + torch_o.id + ")" );
	};

	// Unregister a torch.
	function unregisterTorch(token_o)
	{
		log("unregisterTorch: " + token_o.id);
		var torch = findTorch(token_o);
		if (torch) {
			log("deleting torch token");
			var torch_o = getObj("graphic", torch.id);
			torch_o.remove();
		}
		delete state.QuickLight.torches[token_o.id];
	};

	// Basic "torch" by setting all-player-visible light.
	function toggleTorch(token_o, enable)
   	{
		// Can't do this if there's no image.
		if (!state.QuickLight.imgsrc) {
			sendChat("QuickLight API", "Set an image source with !quicklight-set-imgsrc first");
			return;
		}

		var torch = findTorch(token_o);

		log("toggleTorch: " + token_o.id + ", en: " + enable);

		// If we're turning on a light, make a new token.
		if (enable) {
			var torch = createObj("graphic", {
				subtype : "token",
				pageid : token_o.get("pageid"),
				layer : "walls",
				imgsrc : state.QuickLight.imgsrc,
				name : "QuickLight torch",
				left : token_o.get("left"),
				top : token_o.get("top"),
				width : token_o.get("width"),
				height : token_o.get("height"),
				// DO NOT SET gmnotes in createObj
				aura1_radius : 40,
				auro1_color : "#fff99",
				light_radius : 40,
				light_dimradius : 20,
				light_otherplayers : true
			});

			// Register the torch.
			registerTorch(token_o, torch);            
		}
		else {
			// Unregister the torch.
			unregisterTorch(token_o);
		}

	};

	// Hanhdle yellow marker to toggle the light source.
	function onYellowMarker(obj, prev)
	{
		//log("status changed");
		var yellowIsOn = obj.get("status_yellow");
		var yellowWasOn = prev["statusmarkers"].includes("yellow");
		//log ("YIO " + yellowIsOn + " YWO " + yellowWasOn);
		if (!yellowWasOn && yellowIsOn) {
			//log("turning light on");
			toggleTorch(obj, true);
		}
		else if (yellowWasOn && !yellowIsOn) {
			//log("turning light off");
			toggleTorch(obj, false);
		}
	};

	function onTokenMove(obj, prev)
	{
		// If the token has a torch, move it as well.
		var torch = findTorch(obj);
		if (torch) {
			var torch_o = getObj("graphic", torch.id);
			if (torch_o) {
				torch_o.set({
					left : obj.get("left"),
					top : obj.get("top")
				});
			}
		}          
	};

	function onTokenDestroy(obj)
	{
		// If the token has a torch, unregister it.
		unregisterTorch(obj);
	};

	function onChatMessage(msg)
	{
		if (msg.type == "api") {
			var args = msg.content.split(" ");
			if (args[0] == "!quicklight-set-imgsrc") {
				state.QuickLight.imgsrc = args[1];
			}
		}
	}

	function initialize()
	{
		log("-=> QuickLight v" + this_version + " <=-  [" + this_lastUpdate + "]");

		// Set up the state object.
		if (!_.has(state, "QuickLight")) {
			state.QuickLight = {
				imgsrc : "",
				torches : {}
			};
		}

		if (this_verbose) {
			if (state.QuickLight.imgsrc) {
				log("QuickLight imgsrc: " + state.QuickLight.imgsrc);
			}
			else {
				log("QuickLight imgsrc not set, use !quicklight-set-imgsrc <URL>");
			}
		}

		// DEBUG: start fresh on torches each time
		state.QuickLight.torches = {};

		// Set up the event listeners.
		on("change:graphic:statusmarkers", onYellowMarker);
		on("change:graphic:left", onTokenMove);
		on("change:graphic:top", onTokenMove);
		on("destroy:graphic", onTokenDestroy);
		on("chat:message", onChatMessage);
	};

	// Initialize.
	on("ready", initialize);

	return {
	};

}());

