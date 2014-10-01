/*
* adapt-strickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define(function(require) {

	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');

	require('extensions/adapt-strickle/js/_hacks');

	var strickle = Backbone.View.extend({
		isOn: false,
		children: undefined,
		pageView: undefined,
		currentModel: undefined,
		currentIndex: 0,
		autoScroll: false,
		bottomPadding: 20,
		attach: function(children) {
			this.detach();
			$("html").addClass("strickle");
			strickle.autoScroll = false;
			this.children = children;
			if (this.children === undefined) return;
			if (this.children.length === 0) return;
			_.each(children, function(child) {
				strickle.listenTo(child, 'change:_isInteractionsComplete', strickle.onInteractionComplete);
			});
		},
		detach: function() {
			$("html").removeClass("strickle");
			if (this.children === undefined) return;
			if (this.children.length === 0) return;
			_.each(this.children, function(child) {
				strickle.stopListening(child, 'change:_isInteractionsComplete');
			});
			strickle.children = undefined;
			strickle.currentModel = undefined;
			strickle.pageView = undefined;
			strickle.currentIndex = 0;
		},
		onInteractionComplete: function(child) {
			strickle.autoScroll = true;
			strickle.currentIndex++;
			if (strickle.currentIndex == strickle.children.length) {
				strickle.detach();
				return;
			}
			strickle.currentModel = strickle.children[strickle.currentIndex];
			this.visibility();
			this.tabIndex();
			console.log("interaction complete" + child.get("_id"));
			strickle.resize();
		},
		resize: function(animate) {
			if (this.currentModel === undefined) return;
			var element = $("." + this.currentModel.get("_id"));
			if (element.length === 0) return;
			var offset = element.offset();
			var id = strickle.currentModel.get("_id");
			id = STRIfIdOffsetHiddenReturnParentId(id);
			var padding = this.bottomPadding + parseInt($("#wrapper").css("margin-bottom"));
			if (animate === false ) {
				$("body").css({"height":(offset.top + element.height() + padding) + "px"});
				//if (strickle.autoScroll) $.scrollTo("."+id);
				return;
			}
			$("body").animate({"height":(offset.top + element.height() + padding) + "px"}, 100, function() {
				if (strickle.autoScroll) Adapt.navigateToElement("."+id, {duration:300});
			});
		},
		visibility: function() {
			if (strickle.pageView === undefined) return;
			for(var i = 0; i < this.currentIndex + 1; i++) {
				var child = this.children[i];
				child.set("_isVisible", true, { pluginName: "strickle" });
			}
			for(var i = this.currentIndex + 1; i < this.children.length; i++) {
				var child = this.children[i];
				child.set("_isVisible", false, { pluginName: "strickle" });
			}
		},
		tabIndex: function() {
			if (strickle.pageView === undefined) return;
			for(var i = 0; i < this.currentIndex + 1; i++) {
				var child = this.children[i];
				var component = strickle.pageView.$el.find("."+child.get("_id"));
				if (component.length ===0) continue;
				component.find("button,a,input,select").attr("tabindex","");
			}
			for(var i = this.currentIndex + 1; i < this.children.length; i++) {
				var child = this.children[i];
				var component = strickle.pageView.$el.find("."+child.get("_id"));
				if (component.length ===0) continue;
				component.find("button,a,input,select").attr("tabindex","-1");
			}

			var blockId = this.children[this.currentIndex].get("_parentId");
			var postSiblings = strickle.pageView.$el.find("."+blockId + " ~ *");
			if (this.currentIndex < this.children.length -1) postSiblings.find("button,a,input,select").attr("tabindex", "-1");
			else postSiblings.find("button,a,input,select").attr("tabindex", "");

			var articleId = Adapt.findById(blockId).get("_parentId");
			var postSiblings = strickle.pageView.$el.find("."+articleId + " ~ *");
			if (this.currentIndex < this.children.length -1) postSiblings.find("button,a,input,select").attr("tabindex", "-1");
			else postSiblings.find("button,a,input,select").attr("tabindex", "");
		}
	});
	strickle = new strickle();

	Adapt.on('menuView:postRender', function(menuView) {
		if (strickle.isOn) {
			strickle.isOn = false;
			$("body").css({"height": "auto"});
			$("html").removeClass("strickle");
		}
	});


	Adapt.on('pageView:postRender', function(pageView) {

		var pageModel = pageView.model;
		if (pageModel.get("_strickle") === undefined) {
			if (strickle.isOn) {
				strickle.isOn = false;
				$("body").css({"height": "auto"});
				$("html").removeClass("strickle");
			}
			return;
		}
		var config = pageModel.get("_strickle");
		if (config._isEnabled !== true && config._isEnabled !== undefined ) return;
		strickle.isOn = true;

		_.defer( _.bind(function () {

			strickle.detach();

			strickle.autoScroll = config._autoScroll !== undefined 
										? config._autoScroll
										: true;
			strickle.bottomPadding = config._bottomPadding !== undefined 
										? config._bottomPadding
										: 20;


			var children = pageModel.findDescendants("components").filter(function(child) {
				if (pageModel.get("_strickle")._ignoreComponents) {
					if (pageModel.get("_strickle")._ignoreComponents.indexOf(child.get("_component")) > -1 ) return false;
				}
				if (child.get("_strickle") === undefined ) return true;
				var config = child.get("_strickle");
				if (config._isEnabled !== true && config._isEnabled !== undefined ) return false;
				return true;
			});

			strickle.pageView = pageView;
			strickle.attach(children);
			strickle.currentModel = children[0];
			_.delay(function() { strickle.resize(false); } , 500)

		}, window, pageView));
		
	});

	Adapt.on('componentView:preRender', function(componentView) {
		if (strickle.currentModel === undefined) return;
		var componentModel = componentView.model;
		strickle.visibility();
	});

	Adapt.on('componentView:postRender', function(componentView) {
		if (strickle.currentModel === undefined) return;
		var componentModel = componentView.model;
		strickle.tabIndex();
		if (componentModel.get("_id") != strickle.currentModel.get("_id")) return;
		strickle.resize(false);
	});

	Adapt.on('device:resize', function() {
		strickle.resize(false);
	});

	return strickle;

})