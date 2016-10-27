var VisionTools = VisionTools || (function() {
	"use strict";

	// Version Number
	var this_version = 0.5;
	// Date: (Subtract 1 from the month component)
	var this_lastUpdate = new Date(2016, 9, 27, 0, 20);
	// Verbose (print messages)
	var this_verbose = false;
	
	function setVision(lowLightVision, darkRange, charId)
	{
		// Halve DV if LLV present, since R20 doubles that, too.
		darkRange = lowLightVision ? Math.floor(darkRange / 2) : darkRange;

		var toks = findObjs({
			_type : "graphic",
			_subtype : "token",
			represents : charId,
		});
		_.each(toks, function(tok){
			tok.set({
				light_radius : darkRange > 0 ? darkRange : "",
				light_dimradius : "",
				light_otherplayers : false,
				light_angle : "360",
				light_hassight : true,
				light_multiplier : (lowLightVision ? 2 : 1)
			});
		});
	}

	// Obtain a character's vision from a Character object, and see if there are
	// special vision modes that need to be incorporated.
	function updateCharacterVision(char)
	{
		//log ("Checking vis for " + char.get("name"));

		// ID of the character
		var charId = char.get("_id");

		// Vision regexes
		var darkvision1_re = /darkvision\s*\(\s*(\d+)\s*(ft|'|)\s*\)\s*/;
		var darkvision2_re = /darkvision\s*(\d+)/;
		var lowlight1_re = /low-light\s*vision|lowlight\s*vision/;

		// Get the vision attribute.
		// We don't have the ID, so we have to get "all" of them.
		// We could assume just one is returned, but we'll pretend there could be
		// more (or zero, which is a possibility that is more likely).
		var visionAttrs = findObjs({
			_type : "attribute",
			_characterid : charId,
			name : "vision"
		});

		_.each(visionAttrs, function(attr) {

			var visions = attr.get("current").toLowerCase().split(",");
			var dv = 0;
			var llv = 0;

			_.each(visions, function(vis) {

				var mr = vis.match(darkvision1_re);
				if (mr) {
					dv = mr[1];
				}

				mr = vis.match(darkvision2_re);
				if (mr) {
					dv = mr[1];
				}

				mr = vis.match(lowlight1_re);
				if (mr) {
					llv = 1;
				}
			});

			setVision(llv, dv, charId);
		});
	};

	// Update the vision for a token.
	function updateTokenVision(obj)
	{
		var represents = obj.get("represents");

		if (represents) {
			var characters = findObjs({
				_id : represents,
				_type : "character"
			});

			var char = getObj('character', represents);
			//log("Update vision for token of ", + char.get("name"));
			updateCharacterVision(char);
		}
	};

	// Handle an attribute [vision] changing.
	function onCharacterChanged(obj)
	{
		var charId = obj.get("_characterid");

		if (obj.get("name") === "vision" && charId) {
			var characters = findObjs({
				_id : charId
			});

			var char = getObj('character', charId);
			//log("Vision changed for " + char.get("name"));
			updateCharacterVision(char);
		}
	};

	// Change Page
	function onPlayerPageChanged(obj, prev)
	{
		// The page ID of the object seems to be bad.
		var pageId = Campaign().get("playerpageid");
		// Update the obj reference.
		obj = getObj("page", pageId);

		//log("Player page changed, id: " + obj.id);

		// Get all the tokens on the page and update their vision.
		var tokens = findObjs({
			_type : "graphic",
			_subtype : "token",
			_pageid : obj.get("_id")
		});

		//log("Page: " + obj.get("name") + ", Tokens: " + tokens.length);

		_.each(tokens, function(token){
			updateTokenVision(token);
		});
	}

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
			if (state.VisionTools.imgsrc.length > 0) {
				log("VisionTools imgsrc: " + state.VisionTools.imgsrc);
			}
			else {
				log("VisionTools imgsrc not set, use !mcvis-set-imgsrc <URL>");
			}
		}

		// Set up the event listeners.
		
		// Quick light
		on("change:graphic:statusmarkers", onYellowMarker);
		on("change:graphic:left", onTokenMove);
		on("change:graphic:top", onTokenMove);
		on("destroy:graphic", onTokenDestroy);
		on("chat:message", onChatMessage);

		// Auto Vision
		on("change:attribute:current", onCharacterChanged);
		on("change:campaign:playerpageid", onPlayerPageChanged);
		on("add:token", updateTokenVision);

		// Now check for existing things on the current page.
		// No way to get the GM page, but we'll let the player page suffice.
		var playerPageId = Campaign().get("playerpageid");
		var playerPage = getObj("page", playerPageId);
		// (We actually determine the page in the function, but we'll pretend we
		// don't.)
		onPlayerPageChanged(playerPage);
	};

	// Initialize.
	on("ready", initialize);

	return {
	};

}());

