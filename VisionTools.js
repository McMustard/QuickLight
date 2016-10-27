var VisionTools = VisionTools || (function() {
	"use strict";

	// Version Number
	var this_version = 0.4;
	// Date: (Subtract 1 from the month component)
	var this_lastUpdate = new Date(2016, 9, 26, 23, 48);
	// Verbose (print messages)
	var this_verbose = false;

	// Find the torch token corresponding to the specified token object.
	function findTorch(token_o)
	{
		// Search for the object in the state object.
		var torch = state.VisionTools.torches[token_o.id];
		return torch;
	};

	// Register a torch so it can be removed later.
	function registerTorch(token_o, torch_o)
	{
		// If there is an existing torch entry, delete the old token.
		var torch = state.VisionTools.torches[token_o.id];
		if (torch) {
			var oldTorch_o = getObj("graphic", torch.id);
			log("registerTorch: removing old torch w ID: " + torch.id);
			if (oldTorch_o) { oldTorch_o.remove(); }
		}

		// Present or not, we're going to replace the entry.
		state.VisionTools.torches[token_o.id] = {
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
		delete state.VisionTools.torches[token_o.id];
	};

	// Basic "torch" by setting all-player-visible light.
	function toggleTorch(token_o, enable)
   	{
		// Can't do this if there's no image.
		if (state.VisionTools.imgsrc.length == 0) {
			sendChat("VisionTools API", "Set an image source with !mcvis-set-imgsrc first");
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
				imgsrc : state.VisionTools.imgsrc,
				name : "VisionTools torch",
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
			if (args[0] == "!mcvis-set-imgsrc") {
				state.VisionTools.imgsrc = args[1];
			}
		}
	}

	function initialize()
	{
		log("-=> VisionTools v" + this_version + " <=-  [" + this_lastUpdate + "]");

		// Set up the state object.
		if (!_.has(state, "VisionTools")) {
			state.VisionTools = {
				imgsrc : "",
				torches : {}
			};
		}

		if (this_verbose) {
			if (state.VisionTools.imgsrc) {
				log("VisionTools imgsrc: " + state.VisionTools.imgsrc);
			}
			else {
				log("VisionTools imgsrc not set, use !mcvis-set-imgsrc <URL>");
			}
		}

		// DEBUG: start fresh on torches each time
		// state.VisionTools.torches = {};

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

