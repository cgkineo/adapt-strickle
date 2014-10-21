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
		allchildren: undefined,
		pageView: undefined,
		currentModel: undefined,
		currentIndex: -1,
		autoScroll: false,
		bottomPadding: 20,
		config: undefined,
		attach: function(children, allchildren) {
			this.detach();
			$("html").addClass("strickle");
			strickle.autoScroll = false;
			this.children = children;
			this.allchildren = allchildren;
			if (this.children === undefined) return;
			if (this.children.length === 0) return;
			var initial;
			_.each(children, function(child, index) {
				if (!child.get("_isSubmitted")) {
					strickle.listenTo(child, 'change:_isInteractionsComplete', strickle.onInteractionComplete);
					strickle.listenTo(child, 'change:_attemptsLeft', function(model) {
						_.defer(function() {
							if (model.get("_id") != strickle.currentModel.get("_id")) return;
							var element = $("." + strickle.currentModel.get("_id"));
							if (element.length === 0) return;
							strickle.resize(false);
							if (strickle.config._waitForEvent) {
								Adapt.once(strickle.config._waitForEvent, function() {
									if (strickle.currentModel === undefined) return;
									Adapt.navigateToElement("." + strickle.currentModel.get("_id"));
									if (strickle.currentIndex == -1 || strickle.currentIndex == strickle.children.length) {
										strickle.detach();
									}
								});
							} else {
								if (strickle.currentModel === undefined) return;
								Adapt.navigateToElement("." + strickle.currentModel.get("_id"));
								if (strickle.currentIndex == -1 || strickle.currentIndex == strickle.children.length) {
									strickle.detach();
								}
							}
						});
					})
					if (initial === undefined) {
						initial = child;
						strickle.currentIndex = index;
					}
				}
			});
			strickle.currentModel = initial;
			this.visibility();
		},
		detach: function() {
			$("html").removeClass("strickle");
			if (this.children === undefined) return;
			if (this.children.length === 0) return;
			_.each(this.children, function(child) {
				strickle.stopListening(child, 'change:_attemptsLeft');
				strickle.stopListening(child, 'change:_isInteractionsComplete');
			});
			strickle.children = undefined;
			//strickle.allchildren = undefined;
			strickle.currentModel = undefined;
			strickle.pageView = undefined;
			strickle.currentIndex = -1;
		},
		onInteractionComplete: function(child) {
			strickle.autoScroll = true;
			var currentStrickleId = strickle.children[strickle.currentIndex].get("_id");
			var nextScrollTo = undefined;
			for (var i = 0; i < strickle.allchildren.models.length; i++) {
				if (strickle.allchildren.models[i].get("_id") == currentStrickleId) {
					nextScrollTo = strickle.allchildren.models[i+1];
					break;
				}
			}
			strickle.currentIndex++;
			if (nextScrollTo === undefined) {
				//strickle.detach();
				strickle.resize();
				//strickle.visibility();
				return;
			}
			if (strickle.currentIndex == strickle.children.length) {
				strickle.currentModel = nextScrollTo;
			} else {
				strickle.currentModel = strickle.children[strickle.currentIndex];
			}
			strickle.nextScrollTo = nextScrollTo;
			//console.log("interaction complete" + child.get("_id"));
			strickle.resize();
			//strickle.visibility();
		},
		resize: function(animate) {
			if (this.currentModel === undefined) return;
			var element = $("." + this.currentModel.get("_id"));
			if (element.length === 0) return;
			var offset = element.offset();
			var id;
			if (strickle.nextScrollTo !== undefined) id = strickle.nextScrollTo.get("_id");
			else id = strickle.currentModel.get("_id");
			id = STRIfIdOffsetHiddenReturnParentId(id);
			var padding = this.bottomPadding + parseInt($("#wrapper").css("margin-bottom"));
			if (animate === false || typeof animate == "object") {
				$("body").animate({"height":(offset.top + element.height() + padding) + "px"}, 500);
				return;
			}
			var thisHandle = this;
			function complete() {
				thisHandle.visibility();
				thisHandle.tabIndex();
				if (strickle.currentIndex == -1 || strickle.currentIndex == strickle.children.length) {
					$("body").css({"height": "auto"});
				} else {	
					$("body").css({"height":(offset.top + element.height() + padding) + "px"});
				}
				if (strickle.autoScroll) Adapt.navigateToElement("."+id, {duration: thisHandle.config._animateSpeed || 200, axis: 'y'});
			}
			if (this.config._waitForEvent) {
				Adapt.once(this.config._waitForEvent, complete);
			} else {
				complete();
			}
		},
		visibility: function() {
			if (this.currentIndex == -1) {
				for (var i = 0; i < this.allchildren.models.length; i++) {
					var child = this.allchildren.models[i];
					child.set("_isVisible", true, { pluginName: "strickle" });
					child.getParent().set("_isVisible", true, { pluginName: "strickle" });
				}
			} else {
				var currentId = this.currentModel.get("_id");
				var before = true;
				var visibleBlocks = {};
				var invisibleBlocks = {};
				for (var i = 0; i < this.allchildren.models.length; i++) {
					var child = this.allchildren.models[i];
					if (before) {
						child.set("_isVisible", true, { pluginName: "strickle" });
						child.getParent().set("_isVisible", true, { pluginName: "strickle" });
						visibleBlocks[child.getParent().get("_id")] = true;;
					} else {
						child.set("_isVisible", false, { pluginName: "strickle" });
						if (!visibleBlocks[child.getParent().get("_id")]) {
							invisibleBlocks[child.getParent().get("_id")] = true;
						}
					}
					if (child.get("_id") == currentId) {
						before = false;
					}
				}
				//console.log(visibleBlocks);
				//console.log(invisibleBlocks);
				_.each(invisibleBlocks, function (isVisible, blockId) {
					Adapt.findById(blockId).set("_isVisible", false, { pluginName: "strickle" });
				});
			}
		},
		tabIndex: function() {
			if (strickle.pageView === undefined) return;
			if (this.currentIndex < this.children.length) {
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
		}
	});
	strickle = new strickle();

	Adapt.on('menuView:postRender', function(menuView) {
		if (strickle.isOn) {
			strickle.isOn = false;
			$("body").css({"height": "auto"});
		}
	});


	Adapt.on('pageView:postRender', function(pageView) {

		var pageModel = pageView.model;
		if (pageModel.get("_strickle") === undefined) {
			if (strickle.isOn) {
				strickle.isOn = false;
				$("body").css({"height": "auto"});
			}
			return;
		}
		var config = pageModel.get("_strickle");
		strickle.config = config;
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

			var allchildren = pageModel.findDescendants("components");

			strickle.pageView = pageView;
			strickle.attach(children, allchildren);
			

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
