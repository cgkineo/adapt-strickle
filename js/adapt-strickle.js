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
		prevIndex: -1,
		currentIndex: -1,
		isEnd: false,
		config: undefined,
		events: [],
		start: function(children) {
			strickle.listenTo(Adapt, "article:revealing", function(view) {
				strickle.onArticleRevealing(view);
			});
			strickle.listenTo(Adapt, "article:revealed", function(view) {
				strickle.onArticleRevealed(view);
			});
			$("html").addClass("strickle");
			strickle.autoScroll = false;
			this.children = children;
			this.next(true);
		},
		next: function(initial) {
			if (this.children === undefined) return;
			if (this.children.length === 0) return;
			var next;
			var defaultOn = strickle.config._isDefaultOn || true;
			strickle.prevIndex = strickle.currentIndex;
			for (var i = strickle.currentIndex + 1; i < this.children.length; i++) {
				var child = this.children[i];
				if (child.get("_isSubmitted") || child.get("_isComplete") ) continue;
				if (defaultOn && (child.get("_strickle") === undefined || child.get("_strickle")._isEnabled !== false))  {
					next = child;
					this.currentIndex = i;
					break;
				} else if (!defaultOn && child.get("_strickle") !== undefined && child.get("_strickle")._isEnabled !== false) {
					next = child;
					this.currentIndex = i;
					break;
				}
			};
			if (next === undefined) {
				strickle.isEnd = true;
			}
			this.attach();
			this.refit(initial);
		},
		attach: function() {
			if (this.currentIndex == -1 || strickle.isEnd) return;
			var child = this.children[this.currentIndex];
			var model = child.toJSON();
			var waitForEvent;
			if (model._strickle === undefined || model._strickle._waitForEvent === undefined) waitForEvent = "interactionsComplete";
			var waitforEvents = waitForEvent.split(" ");

			strickle.stopListening();

			if (model._feedback && model._canShowFeedback !== false &&  waitforEvents.indexOf("tutor") == -1) {
				waitforEvents.unshift("tutor");
			}

			for (var i =0 ; i < waitforEvents.length; i++) {
				switch(waitforEvents[i]) {
				case "interactionsComplete":
					strickle.events.push({
						on: child, 
						eventName: "change:_isInteractionsComplete", 
						callback: this.onEvent
					});
					break;
				case "tutor":
					strickle.events.push({
						on: Adapt, 
						eventName: "tutor:closed", 
						callback: this.onEvent
					});
					break;
				default:
					throw "Event not defined for strickle use";
				}
			}


			var initialEvent = strickle.events.pop();
			strickle.listenToOnce(	initialEvent.on, initialEvent.eventName, initialEvent.callback );
		},
		onEvent: function () {
			if (strickle.events.length > 0) {
				var initialEvent = strickle.events.pop();
				strickle.listenToOnce(	initialEvent.on, initialEvent.eventName, initialEvent.callback );
				return;
			} else {
				this.next();
			}
		},
		detach: function() {
			$("html").removeClass("strickle");
			strickle.isOn = false;
			$('body').css({
				height: ""
			});
			isOn: false,
			strickle.children = undefined;
			strickle.pageView = undefined;
			strickle.currentIndex = -1;
			strickle.config = undefined;
			strickle.events = [];
			strickle.isEnd = false;
			strickle.stopListening();
		},
		resize: function(initial) {
			var id;
			var child;
			if (strickle.isEnd) {
				if (this.currentIndex+1 <= this.children.length - 1) {
					id = this.children[this.currentIndex+1].get("_id");
					child = this.children[this.currentIndex+1];
				} else {
					id = this.children[this.currentIndex].get("_id");
					child = this.children[this.currentIndex];
				}
			} else {
				id = this.children[this.currentIndex].get("_id");
				child = this.children[this.currentIndex];
			}

			var rid = "";
			while(true) {
				rid = STRIfIdOffsetHiddenReturnParentId(id);
				if (id === rid) break;
				id = rid;
			}

			var element = $("." + id);
			if (element.length === 0) return;

			console.log("resizing to : " + id);

			var offset = element.offset();
			var padding = (this.config._bottomPadding || 20) + parseInt($("#wrapper").css("margin-bottom"));

			if (strickle.isEnd) $("body").css({"height": ""});
			else $("body").css({"height":(offset.top + element.height() + padding) + "px"});

			if (initial === true || typeof initial == "object") return;

			var scrollChild = this.children[this.prevIndex];
			if ( (strickle.config._autoScroll && (scrollChild.get("_strickle") === undefined || scrollChild.get("_strickle")._autoScroll !== false) ) || (scrollChild.get("_strickle") !== undefined && scrollChild.get("_strickle")._autoScroll === true ) ) {
				Adapt.navigateToElement("."+id, {duration: strickle.config._animateSpeed || 200, axis: 'y'});
			}

			//if (strickle.autoScroll) Adapt.navigateToElement("."+id, {duration: thisHandle.config._animateSpeed || 200, axis: 'y'});
		},
		visibility: function() {
			if (strickle.isEnd) {
				for (var i = 0; i < this.children.length; i++) {
					var child = this.children[i];
					child.set("_isVisible", true, { pluginName: "strickle" });
					child.getParent().set("_isVisible", true, { pluginName: "strickle" });
				}
			} else {
				var currentId = this.children[this.currentIndex].get("_id");
				var before = true;
				var visibleBlocks = {};
				var invisibleBlocks = {};
				for (var i = 0; i < this.children.length; i++) {
					var child = this.children[i];
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
			if (this.currentIndex == -1) return;
			if (strickle.isEnd) {

				for(var i = 0; i < this.children.length; i++) {
					var child = this.children[i];
					var component = strickle.pageView.$el.find("."+child.get("_id"));
					if (component.length ===0) continue;
					var cmps = component.find("button,a,input,select");
					cmps.each(function (index, item) {
						var item = $(item);
						if (item.attr("prevtabindex")) {
							item.attr("tabindex", item.attr("prevtabindex"));
							item.removeAttr("prevtabindex");
						} else {
							item.attr("tabindex", "");
						}
					});
				}

				var blockId = this.children[this.currentIndex].get("_parentId");
				var postSiblings = strickle.pageView.$el.find("."+blockId + " ~ *");
				var cmps = postSiblings.find("button,a,input,select");
				cmps.each(function (index, item) {
					var item = $(item);
					if (item.attr("prevtabindex") !== undefined) {
						item.attr("tabindex", item.attr("prevtabindex"));
						item.removeAttr("prevtabindex");
					} else {
						item.attr("tabindex", "");
					}
				});

				var articleId = Adapt.findById(blockId).get("_parentId");
				var postSiblings = strickle.pageView.$el.find("."+articleId + " ~ *");
				var cmps = postSiblings.find("button,a,input,select");
				cmps.each(function (index, item) {
					var item = $(item);
					if (item.attr("prevtabindex") !== undefined) {
						item.attr("tabindex", item.attr("prevtabindex"));
						item.removeAttr("prevtabindex");
					} else {
						item.attr("tabindex", "");
					}
				});

			} else {

				for(var i = 0; i < this.currentIndex + 1; i++) {
					var child = this.children[i];
					var component = strickle.pageView.$el.find("."+child.get("_id"));
					if (component.length ===0) continue;
					var cmps = component.find("button,a,input,select");
					cmps.each(function (index, item) {
						var item = $(item);
						if (item.attr("prevtabindex")) {
							item.attr("tabindex", item.attr("prevtabindex"));
							item.removeAttr("prevtabindex");
						} else {
							item.attr("tabindex", "");
						}
					});
				}

				var blockId = this.children[this.currentIndex].get("_parentId");
				var postSiblings = strickle.pageView.$el.find("."+blockId + " ~ *");
				var cmps = postSiblings.find("button,a,input,select");
				cmps.each(function (index, item) {
					var item = $(item);
					if (item.attr("prevtabindex") !== undefined) {
						item.attr("tabindex", -1);
						return;
					};
					item.attr("prevtabindex", item.attr("tabindex") || 0);
					item.attr("tabindex", -1);
				});

				var articleId = Adapt.findById(blockId).get("_parentId");
				var postSiblings = strickle.pageView.$el.find("."+articleId + " ~ *");
				var cmps = postSiblings.find("button,a,input,select");
				cmps.each(function (index, item) {
					var item = $(item);
					if (item.attr("prevtabindex") !== undefined) {
						item.attr("tabindex", -1);
						return;
					};
					item.attr("prevtabindex", item.attr("tabindex") || 0);
					item.attr("tabindex", -1);
				});
			}
		},
		onArticleRevealing: function(view) {
			strickle.articleRevealingInterval = setInterval(function() {
				strickle.resize(true);
			},1);
			strickle.resize(true);
		},
		onArticleRevealed: function(view) {
			clearInterval(strickle.articleRevealingInterval);
			strickle.resize(true);	
		},
		refit: function(initial) {
			_.defer(function(){
				strickle.visibility();
				strickle.resize(initial);
				strickle.tabIndex();	
			});
		}
	});
	strickle = new strickle();

	Adapt.on('menuView:postRender', function(menuView) {
		strickle.detach();
	});


	Adapt.on('pageView:ready', function(pageView) {

		var pageModel = pageView.model;
		strickle.detach();
		if (pageModel.get("_strickle") === undefined) return;

		var config = pageModel.get("_strickle");
		strickle.config = config;
		if (config._isEnabled !== true && config._isEnabled !== undefined ) return;
		strickle.isOn = true;

		_.defer( _.bind(function () {

			var children = pageModel.findDescendants("components").models;

			strickle.pageView = pageView;
			strickle.start(children);

		}, window));
	});

	Adapt.on('device:resize', function() {
		_.defer(function(){
			if (strickle.pauseFor) {
				setTimeout( function() {
					strickle.resize(true);
				}, strickle.pauseFor);
			} else {
				strickle.resize(true);
			}
		});
	});

	return strickle;

})