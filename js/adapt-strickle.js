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
			strickle.listenTo(Adapt, "article:revealing", function(view) {
				strickle.onArticleRevealing(view);
			});
			strickle.listenTo(Adapt, "article:revealed", function(view) {
				strickle.onArticleRevealed(view);
			});
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
							var disabled = (strickle.currentModel.get("_strickle") !== undefined && strickle.currentModel.get("_strickle")._autoScroll === false);
							if (strickle.config._waitForEvent) {
								Adapt.once(strickle.config._waitForEvent, function() {
									if (strickle.currentModel === undefined) return;
									if (strickle.autoScroll && !disabled) Adapt.navigateToElement("." + strickle.currentModel.get("_id"));
									if (strickle.currentIndex == -1 || strickle.currentIndex == strickle.children.length) {
										strickle.detach();
									}
								});
							} else {
								if (strickle.currentModel === undefined) return;
								if (strickle.autoScroll && !disabled) Adapt.navigateToElement("." + strickle.currentModel.get("_id"));
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
			strickle.nextScrollTo = initial;
			strickle.prevScrollTo = initial;
			this.visibility();
		},
		detach: function() {
			$("html").removeClass("strickle");
			if (this.children === undefined) return;
			if (this.children.length === 0) return;
			strickle.stopListening(Adapt, 'article:revealing');
			strickle.stopListening(Adapt, 'article:revealed');
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
		onInteractionComplete: function(child, value) {
			if (!value) return;
			if (strickle.currentIndex >= strickle.children.length) return;
			
			strickle.autoScroll = strickle.config._autoScroll !== undefined 
										? strickle.config._autoScroll
										: true;
			var currentStrickleId = strickle.children[strickle.currentIndex].get("_id");
			var nextScrollTo = undefined;
			for (var i = 0; i < strickle.allchildren.length; i++) {
				if (strickle.allchildren[i].get("_id") == currentStrickleId) {
					nextScrollTo = strickle.allchildren[i+1];
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
			strickle.prevScrollTo = strickle.nextScrollTo;
			strickle.nextScrollTo = nextScrollTo;
			//console.log("interaction complete" + child.get("_id"));
			strickle.resize();
			//strickle.visibility();
		},
		resize: function(animate) {
			if (this.currentModel === undefined) return;
			var id;
			if (strickle.nextScrollTo !== undefined) id = strickle.nextScrollTo.get("_id");
			else id = strickle.currentModel.get("_id");
			var rid = "";
			while(true) {
				rid = STRIfIdOffsetHiddenReturnParentId(id);
				if (id === rid) break;
				id = rid;
			}

			var element = $("." + id); //this.currentModel.get("_id")
			if (element.length === 0) return;
			var offset = element.offset();

			var padding = this.bottomPadding + parseInt($("#wrapper").css("margin-bottom"));
			if (animate === false || typeof animate == "object") {
				$("body").css({"height":(offset.top + element.height() + padding) + "px"});
				return;
			}
			var thisHandle = this;
			function complete() {
				thisHandle.visibility();
				thisHandle.tabIndex();
				if (strickle.currentIndex == -1 || strickle.currentIndex == strickle.children.length) {
					$("body").css({"height": ""});
				} else {	
					$("body").css({"height":(offset.top + element.height() + padding) + "px"});
				}
				var disabled = (strickle.prevScrollTo.get("_strickle") !== undefined && strickle.prevScrollTo.get("_strickle")._autoScroll === false);
				if (strickle.autoScroll && !disabled) Adapt.navigateToElement("."+id, {duration: thisHandle.config._animateSpeed || 200, axis: 'y'});
			}
			if (this.config._waitForEvent && strickle.prevScrollTo.get("_feedback") && (strickle.currentIndex != -1 && strickle.currentIndex != strickle.children.length)) {
				Adapt.once(this.config._waitForEvent, complete);
			} else {
				complete();
			}
		},
		visibility: function() {
			if (this.currentIndex == -1) {
				for (var i = 0; i < this.allchildren.length; i++) {
					var child = this.allchildren[i];
					child.set("_isVisible", true, { pluginName: "strickle" });
					child.getParent().set("_isVisible", true, { pluginName: "strickle" });
				}
			} else {
				var currentId = this.currentModel.get("_id");
				var before = true;
				var visibleBlocks = {};
				var invisibleBlocks = {};
				for (var i = 0; i < this.allchildren.length; i++) {
					var child = this.allchildren[i];
					if (before || (child.get("_strickle") && child.get("_strickle")._isEnabled === false)) {
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
		},
		onArticleRevealing: function(view) {
			strickle.articleRevealingInterval = setInterval(function() {
				console.log("revealing");
				strickle.resize(false);
			},1);
			console.log("revealing");
			strickle.resize(false);
		},
		onArticleRevealed: function(view) {
			console.log("revealed");
			clearInterval(strickle.articleRevealingInterval);
			strickle.resize(false);	
		}
	});
	strickle = new strickle();

	Adapt.on('menuView:postRender', function(menuView) {
		if (strickle.isOn) {
			strickle.isOn = false;
			$("body").css({"height": ""});
		}
	});


	Adapt.on('pageView:ready', function(pageView) {

		var pageModel = pageView.model;
		if (strickle.isOn) {
			strickle.isOn = false;
			strickle.nextScrollTo = undefined;
			$("body").css({"height": ""});
		}
		if (pageModel.get("_strickle") === undefined) {
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

			strickle.pauseFor = config._pauseFor;


			var children = pageModel.findDescendants("components").filter(function(child) {
				if (pageModel.get("_strickle")._ignoreComponents) {
					if (pageModel.get("_strickle")._ignoreComponents.indexOf(child.get("_component")) > -1 ) return false;
				}
				if (child.get("_strickle") === undefined ) return true;
				var config = child.get("_strickle");
				if (config._isEnabled !== true && config._isEnabled !== undefined ) return false;
				return true;
			});

			var allchildren = pageModel.findDescendants("components").filter(function(child) {
				if (pageModel.get("_strickle")._ignoreComponents) {
					if (pageModel.get("_strickle")._ignoreComponents.indexOf(child.get("_component")) > -1 ) return false;
				}
				return true;
			});

			strickle.pageView = pageView;
			strickle.attach(children, allchildren);


		}, window, pageView));
	});

	Adapt.on('pageView:ready', function(pageView) {
		_.defer(function(){
			strickle.resize(false)
		});

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
		/*if (componentModel.get("_id") != strickle.currentModel.get("_id")) return;
		strickle.resize(false);*/
	});

	Adapt.on('device:resize', function() {
		if (strickle.pauseFor) {
			setTimeout( function() {
				strickle.resize(false);
			}, strickle.pauseFor);
		} else {
			strickle.resize(false);
		}
	});

	return strickle;

})