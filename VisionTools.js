var VisionTools = VisionTools || (function() {
	"use strict";

	// Version Number
	var this_version = 0.8;
	// Date: (Subtract 1 from the month component)
	var this_lastUpdate = new Date(2016, 9, 29, 3, 14);
	// Verbose (print messages)
	var this_verbose = false;
	// Auto-size "tiny" and smaller tokens below unit size
	var this_enableSubunitTokens = true;
	// Grid size
	var GRID_SIZE = 70;

	//
	// General Functions

	// Return a collection of tokens for the specified character.
	//     charId: character object ID
	function tokensFor(charId)
	{
		var toks = findObjs({
			_type : "graphic",
			_subtype : "token",
			represents : charId,
		});
		return toks;
	}

	// Return the character that the specified token represents.
	//     token: Roll20 token object
	function characterFor(token)
	{
		var represents = token.get("represents");
		return getObj("character", represents);
	}

	// Find the torch token corresponding to the specified token.
	//     token: Roll20 token object
	function findTorch(token)
	{
		// Search for the object in the state object.
		var torch = state.VisionTools.torches[token.id];
		return torch;
	}

	// Set the vision of a token.
	//     token: Roll20 token object
	//     llv: low-light vision flag
	//     dv: darkvision range, feet
	function setVision(token, llv, dv)
	{
		// Halve DV if LLV present, since Roll20 doubles that (as any
		// other light source).
		dv = llv ? Math.floor(dv / 2) : dv;

		token.set({
			light_radius : dv > 0 ? dv : "",
			light_dimradius : "",
			light_otherplayers : false,
			light_angle : "360",
			light_hassight : true,
			light_multiplier : (llv ? 2 : 1)
		});
	}

	// Set the size of a token.
	//     token: Roll20 token object
	//     size: x and y dimensions
	function setSize(token, size)
	{
		token.set({
			width : size,
			height : size
		});
	}

	// Register a torch so it can be removed later.
	//     token: Roll20 token object
	//     torch: torch object
	function registerTorch(token, torch)
	{
		// If there is an existing torch entry, delete the old token.
		var torch = state.VisionTools.torches[token.id];
		if (torch) {
			var oldTorch = getObj("graphic", torch.id);
			log("registerTorch: removing old torch w ID: " + torch.id);
			if (oldTorch) { oldTorch.remove(); }
		}

		// Present or not, we're going to replace the entry.
		state.VisionTools.torches[token.id] = {
			// ID of the torch object
			id : torch.id,
			// ID of the torch's owner
			owner : token.id
		};

		log("registerTorch(" + token.id + ", " + torch.id + ")" );
	}

	// Unregister a torch.
	//     token: Roll20 token object
	//     torch: torch object
	function unregisterTorch(token)
	{
		log("unregisterTorch: " + token.id);
		var torch = findTorch(token);
		if (torch) {
			log("deleting torch token");
			var torch = getObj("graphic", torch.id);
			torch.remove();
		}
		delete state.VisionTools.torches[token.id];
	}

	// Basic "torch" by setting all-player-visible light.
	//     token: Roll20 token object
	//     enable: turn on or off the torch corresponding to 'token'
	function toggleTorch(token, enable)
	{
		// Can't do this if there's no image.
		if (state.VisionTools.imgsrc.length == 0) {
			sendChat("VisionTools API", "Set an image source with !mcvis-set-imgsrc first");
			return;
		}

		var torch = findTorch(token);

		log("toggleTorch: " + token.id + ", en: " + enable);

		// If we're turning on a light, make a new token.
		if (enable) {
			var torch = createObj("graphic", {
				subtype : "token",
				pageid : token.get("pageid"),
				layer : "walls",
				imgsrc : state.VisionTools.imgsrc,
				name : "VisionTools torch",
				left : token.get("left"),
				top : token.get("top"),
				width : token.get("width"),
				height : token.get("height"),
				// DO NOT SET gmnotes in createObj
				aura1_radius : 40,
				auro1_color : "#fff99",
				light_radius : 40,
				light_dimradius : 20,
				light_otherplayers : true
			});

			// Register the torch.
			registerTorch(token, torch);
		}
		else {
			// Unregister the torch.
			unregisterTorch(token);
		}

	}

	//
	// Specific Event Handlers
	
	// Obtain a character's vision from a Character object, and see if
	// there are special vision modes that need to be incorporated.
	//     char: Roll20 character object
	function onCharacterVisionChanged(char)
	{
		if (!char) { return; }

		log("onCharacterVisionChanged(" + char + ")");
		log("Checking vis for " + char.get("name"));

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

			_.each(tokensFor(charId), function(token) {
				setVision(token, llv, dv);
			});
		});
	}

	// Obtain a character's size from a Character object, and set its token sizes.
	//     character: Roll20 character object
	function onCharacterSizeChanged(character)
	{
		if (!character) { return; }

		// Synonym
		var charId = character.id;

		// Get the size attribute.
		// We don't have the ID, so we have to get "all" of them.
		// We could assume just one is returned, but we'll pretend there could be
		// more (or zero, which is a possibility that is more likely).
		var sizeAttrs = findObjs({
			_type : "attribute",
			_characterid : charId,
			name : "size"
		});

		_.each(sizeAttrs, function(attr) {
			//log("Size is " + attr.get("current"));
			var size = parseInt(attr.get("current"), 10);
			var dimension = 0;

			switch (size) {
				// Any tiny or smaller can be 1/4x or 1x.
				case 8: // fine
				case 4: // diminutive
				case 2: // tiny
					dimension = this_enableSubunitTokens ? GRID_SIZE / 2 : GRID_SIZE;
					break
				case 1: // small
					dimension = GRID_SIZE;
					break;
				case 0: // medium
					dimension = GRID_SIZE;
					break;
				case -1: // large
					dimension = GRID_SIZE * 2;
					break;
				case -2: // huge
					dimension = GRID_SIZE * 3;
					break;
				case -4: // gargantuan
					dimension = GRID_SIZE * 4;
					break;
				case -8: // colossal
					dimension = GRID_SIZE * 5;
					break;
			}

			if (dimension > 0) {
				var toks = tokensFor(charId);
				_.each(tokensFor(charId), function(token) {
					setSize(token, dimension);
				});
			}
		});
	}

	//
	// Roll20 Event Handlers

	// Handle an attribute [vision] changing.
	//     obj: Roll20 character object
	function onCharacterChanged(obj)
	{
		// If the vision changed, update the token(s)
		var character = getObj("character", obj.get("_characterid"));
		if (obj.get("name") === "vision") {
			//log("Vision changed for " + character.get("name"));
			onCharacterVisionChanged(character);
		}
		else if (obj.get("name") === "size") {
			//log("Size changed for " + character.get("name"));
			onCharacterSizeChanged(character);
		}
	}

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
			onCharacterVisionChanged(characterFor(token));
		});
	}

	// Hanhdle yellow marker to toggle the light source.
	function onTokenStatus(obj, prev)
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
	}

	function onTokenMove(obj, prev)
	{
		// If the token has a torch, move it as well.
		var torch = findTorch(obj);
		if (torch) {
			var torch = getObj("graphic", torch.id);
			if (torch) {
				torch.set({
					left : obj.get("left"),
					top : obj.get("top")
				});
			}
		}
	}

	function onTokenAdded(obj)
	{
		var character = getObj("character", obj.get("represents"));
		onCharacterVisionChanged(character);
		onCharacterSizeChanged(character);
	}

	function onTokenDestroy(obj)
	{
		// If the token has a torch, unregister it.
		unregisterTorch(obj);
	}

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
		on("change:graphic:statusmarkers", onTokenStatus);
		on("change:graphic:left", onTokenMove);
		on("change:graphic:top", onTokenMove);
		on("destroy:graphic", onTokenDestroy);
		on("chat:message", onChatMessage);

		// Auto Vision
		on("change:attribute:current", onCharacterChanged);
		on("change:campaign:playerpageid", onPlayerPageChanged);
		on("add:token", onTokenAdded);

		// Now check for existing things on the current page.
		// No way to get the GM page, but we'll let the player page suffice.
		var playerPageId = Campaign().get("playerpageid");
		var playerPage = getObj("page", playerPageId);
		// (We actually determine the page in the function, but we'll pretend we
		// don't.)
		onPlayerPageChanged(playerPage);
	}

	// Initialize.
	on("ready", initialize);

	return {
	};

}());

