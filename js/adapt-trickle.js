/*
* adapt-trickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'coreJS/adapt', 
	'./DataTypes/StructureType', 
	'./Defaults/DefaultTrickleConfig',
	'./trickle-tutorPlugin',
	'./trickle-buttonView',
	'./lib/dom-resize-event'
	], function(Adapt, StructureType, DefaultTrickleConfig) {

	var Trickle = _.extend({

		model: new Backbone.Model({}),

		_stopListeningToResizeEvent: true,

		initialize: function() {
			this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
		},

		onDataReady: function() {
			this.setupEventListeners();
		},

		setupEventListeners: function() {
			this._onWrapperResize = _.bind(Trickle.onWrapperResize, Trickle);
			$("#wrapper").on('resize', this._onWrapperResize );

			this.listenTo(Adapt, "remove", this.onRemove);
			this.listenTo(Adapt, "pageView:preRender", this.onPageInitialize);
			this.listenTo(Adapt, "pageView:postRender", this.onPageReady);
			this.listenTo(Adapt, "pageView:ready", this.onPageReady);

			this.listenTo(Adapt, "articleView:preRender", this.onArticlePreRender);
			this.listenTo(Adapt, "blockView:postRender articleView:postRender", this.onArticleAndBlockPostRender);

			this.listenTo(Adapt.articles, "change:_isInteractionComplete", this.onAnyComplete);
			this.listenTo(Adapt.blocks, "change:_isInteractionComplete", this.onAnyComplete);
			this.listenTo(Adapt.components, "change:_isInteractionComplete", this.onAnyComplete);           

			this.listenTo(Adapt, "trickle:interactionComplete", this.onAnyComplete);

			this.listenTo(Adapt, "steplocking:wait", this.onSteplockingWait);
			this.listenTo(Adapt, "steplocking:unwait", this.onSteplockingUnwait);

			this.listenTo(Adapt, "trickle:relativeScrollTo", this.relativeScrollTo);
		},

		onRemove: function(view) {
			this.removeTrickle();
		},

		addTrickle: function() {
			$("html").addClass("trickle");
			Adapt.trigger("steplocking:waitInitialize");
		},

		removeTrickle: function() {
			this._currentStepIndex = -1;
			this._isFinished = true;
			$("body").css("height", "");
			$("html").removeClass("trickle");
			this.hideElements();
		},

		onPageInitialize: function(view) {
			this.initializePage(view);
		},

		initializePage: function(view) {
			var pageId = view.model.get("_id");

			var pageConfig = Adapt.course.get("_trickle");
			if (pageConfig && pageConfig._isEnabled === false) return;

			var descendantsChildrenFirst = this.getDescendantsFlattened(pageId);
			var descendantsParentFirst = this.getDescendantsFlattened(pageId, true);

			this._descendantsChildrenFirst = descendantsChildrenFirst;
			this._descendantsParentFirst = descendantsParentFirst;
			this._currentStepIndex = 0;
			this._isFinished = false;
			this._stopListeningToResizeEvent = true;
			
			this.checkResetChildren();

			this.initializeSteplockingWait();

		},

		checkResetChildren: function() {
			var descendantsChildrenFirst = this._descendantsChildrenFirst;
			for (var i = 0, l = descendantsChildrenFirst.models.length; i < l; i++) {
				var model = descendantsChildrenFirst.models[i];
				var trickleConfig = this.getModelTrickleConfig(model);
				if (!trickleConfig._stepLocking) continue;

				if (!trickleConfig._stepLocking._isEnabled) continue;

				if (!trickleConfig._isInteractionComplete) {
					
					trickleConfig._isLocking = true;

				} else if (trickleConfig._stepLocking._isLockedOnRevisit && !trickleConfig._stepLocking._isCompletionRequired) {

					trickleConfig._isInteractionComplete = false;
					trickleConfig._isLocking = true;
					model.set("_isInteractionComplete", false);

				} else if ( trickleConfig._stepLocking._isCompletionRequired && !model.get("_isInteractionComplete") ) {
					
					trickleConfig._isInteractionComplete = false;
					trickleConfig._isLocking = true;
					model.set("_isInteractionComplete", false);

				} else if ( trickleConfig._stepLocking._isLockedOnRevisit && trickleConfig._stepLocking._isCompletionRequired && model.get("_isInteractionComplete") ) {
					
					trickleConfig._isInteractionComplete = true;
					trickleConfig._isLocking = true;

				}

			}
		},

		onArticlePreRender: function(view) {
			var model = view.model;
			//ignore _isTrickleInteractiveComponents
			if (model.get("_isTrickleInteractiveComponent")) return;

			this.checkApplyTrickleToChildren(model);

		},

		checkApplyTrickleToChildren: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model);
			if (!trickleConfig) return;

			if (!trickleConfig._onChildren) return;

			this.applyTrickleToChildren(model, trickleConfig);
		},

		applyTrickleToChildren: function(model, trickleConfig) {
			var children = model.getChildren();
			for (var i = 0, l = children.models.length; i < l; i++) {
				var child = children.models[i];
				var childTrickleConfig = this.getModelTrickleConfig(child);
				if (childTrickleConfig) {
					child.set("_trickle", $.extend(true, 
						{}, 
						trickleConfig, 
						childTrickleConfig, 
						{ 
							_id: child.get("_id"),
							_onChildren: false,
							_isEnabled: trickleConfig._isEnabled
						}
					));
				} else {
					child.set("_trickle", $.extend(true, 
						{}, 
						trickleConfig, 
						{ 
							_id: child.get("_id"),
							_onChildren: false 
						}
					));
				}           

			}
		},

		getModelTrickleConfig: function(model) {

			function initializeModelTrickleConfig(model, parent) {
				var trickleConfig = model.get("_trickle");

				var courseConfig = Adapt.course.get("_trickle");
				if (courseConfig && courseConfig._isEnabled === false) return false;

				var trickleConfig = $.extend(true, 
					{}, 
					DefaultTrickleConfig, 
					trickleConfig,
					{ 
						_id: model.get("_id"), 
						_areDefaultsSet: true,
						_index: parent.getModelPageIndex(model)
					}
				);

				model.set("_trickle", trickleConfig);

				return true;
			}

			var trickleConfig = model.get("_trickle");
			if (trickleConfig === undefined) return false;

			//if has been initialized already, return;
			if (trickleConfig._areDefaultsSet) return trickleConfig;

			if (!initializeModelTrickleConfig(model, this)) return false;
			
			return model.get("_trickle");
		},

		onPageReady: function(view) {
			this.initializeStep();
		},

		initializeStep: function() {
			if (this.isFinished()) return;
			this.initializeSteplockingWait();

			if (this.setupStepLock()) {
				this.addTrickle();
			} else {
				this.removeTrickle();
			}
		},

		isFinished: function() {
			var isFinished = this._isFinished;
			return isFinished;
		},

		setupStepLock: function() {
			var currentIndex = this._currentStepIndex;
			var descendants = this._descendantsChildrenFirst;
			for (var i = currentIndex, l = descendants.models.length; i < l; i++) {
				var descendant = descendants.models[i];

				if (!this.isModelStepLocking(descendant)) continue;

				this._currentStepIndex = i;

				this._stopListeningToResizeEvent = false;

				this.resizeBodyToCurrentIndex();

				return true;
			}

			return false;
		},

		isModelStepLocking: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model)
			if (!trickleConfig) return false;

			if (trickleConfig._onChildren) return false;
			
			if (!trickleConfig._stepLocking._isEnabled) return false;
			
			if (trickleConfig._isLocking) return true;
			if (trickleConfig._isInteractionComplete) return false;

			if (!this.isModelTrickleEnabled(model)) return false;

			var isComplete = model.get("_isInteractionComplete");
			if (isComplete !== undefined) return !isComplete;

			return true;
		},

		isModelTrickleEnabled: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model);
			if (!trickleConfig) return false;

			if (trickleConfig._isEnabled === false) return false;

			var isOnPage = (this.getModelPageIndex(model) != -1);
			if (!isOnPage) return false;

			if (trickleConfig._onChildren) return false;

			return true;
		},

		getModelPageIndex: function(model) {
			var descendants = this._descendantsChildrenFirst.toJSON();
			var pageDescendantIds = _.pluck(descendants, "_id");

			var id = model.get("_id");
			var index = _.indexOf( pageDescendantIds, id );

			return index;
		},

		resizeBodyToCurrentIndex: function() {
			this._stopListeningToResizeEvent = true;

			this.hideElements();

			var model = this.getCurrentStepModel();
			var id = model.get("_id");
			var $element = $("." + id);

			if ($element.length === 0) {
				this._stopListeningToResizeEvent = false
				return;
			}

			var elementOffset = $element.offset();
			var elementBottomOffset = elementOffset.top + $element.height();

			$('body').css("height", elementBottomOffset + "px");

			this._stopListeningToResizeEvent = false;
		},

		getCurrentStepModel: function() {
			if (this.isFinished()) return;

			return this._descendantsChildrenFirst.models[this._currentStepIndex];
		},

		hideElements: function() {
			if (this._descendantsParentFirst === undefined) return;

			var model = this.getCurrentStepModel();
			var descendantsParentFirstJSON = this._descendantsParentFirst.toJSON();

			var id;
			if (model !== undefined) {
				id = model.get("_id");
			} else {
				id = descendantsParentFirstJSON[descendantsParentFirstJSON.length -1]._id;
			}
			
			var pageDescendantIds = _.pluck(descendantsParentFirstJSON, "_id");
			var currentStepParentFirstIndex = _.indexOf(pageDescendantIds, id);

			var jquerySelector;
			var elementIdsAfterCurrent = [];
			for (var i = currentStepParentFirstIndex + 1, l = pageDescendantIds.length; i < l; i++) {
				elementIdsAfterCurrent.push(pageDescendantIds[i]);
			}
			

			var elementIdsBeforeCurrent = [];
			for (var i = 0, l = currentStepParentFirstIndex+1; i < l; i++) {
				elementIdsBeforeCurrent.push(pageDescendantIds[i]);
			}

			elementIdsAfterCurrent = _.difference(elementIdsAfterCurrent, elementIdsBeforeCurrent);

			for (var i = 0, l = elementIdsAfterCurrent.length; i < l; i++) {
				var itemModel = Adapt.findById(elementIdsAfterCurrent[i]);
				itemModel.set("_isVisible", false);
				itemModel.setOnChildren({_isVisible: false});
			}

			for (var i = 0, l = elementIdsBeforeCurrent.length; i < l; i++) {
				var itemModel = Adapt.findById(elementIdsBeforeCurrent[i]);
				itemModel.set("_isVisible", true);
				itemModel.setOnChildren({_isVisible: true});
			}

			console.log('before',elementIdsBeforeCurrent);
			console.log('after',elementIdsAfterCurrent);

			console.log("Unlocking to:", id);
		},

		onArticleAndBlockPostRender: function(view) {
			//if (this.isFinished()) return;

			var model = view.model;
			//ignore _isTrickleInteractiveComponents
			if (model.get("_isTrickleInteractiveComponent")) return;

			this.setupStep(model);
		},

		setupStep: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model)
			if (!trickleConfig) return;

			if (trickleConfig._onChildren) return;

			this.checkResetChild(model);

			Adapt.trigger("trickle:interactionInitialize", model);
		},

		checkResetChild: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model)
			var isStepLocking = this.isModelStepLocking(model);
			if (trickleConfig === undefined) return;
			if (trickleConfig._stepLocking === undefined) return;
			trickleConfig._isStepLocking = isStepLocking;
			/*if (trickleConfig._stepLocking._isLockedOnRevisit) {
				trickleConfig._isInteractionComplete = !isStepLocking;
			}*/
		},

		//completion reorder and processing
		_completionQueue: [],
		onAnyComplete: function(model, value, performingCompletionQueue) {
			if (value === false) return;    

			if (performingCompletionQueue !== true) {
				//article, block and component completion trigger in a,b,c order need in c,b,a order
				//otherwise block completion events will occur before component completion events
				var modelStructureType = StructureType.fromString(model.get("_type"));
				var isLastType = (modelStructureType._level === StructureType.levels);

				if (!isLastType) {
					//defer completion event handling if not at component level
					return this._completionQueue.push({
						model: model,
						value: value    
					});
				} else {
					//if at component level, handle completion queue events after component completion is handled
					_.defer(_.bind(this.performCompletionQueue, this));
				}
			}

			Adapt.trigger("steplocking:waitCheck", model);
			this.checkStepComplete(model);
		},

		performCompletionQueue: function() {
			while (this._completionQueue.length > 0) {
				var item = this._completionQueue.pop();
				this.onAnyComplete(item.model, item.value, true);
			}
		},

		checkStepComplete: function(model) {
			if (this.isFinished()) return;

			var currentModel = this.getCurrentStepModel();
			//check if the step is complete only if the model matches the current trickle item, or the completion came from a trickle interactive component
			if (model.get("_id") != currentModel.get("_id") && !model.get("_isTrickleInteractiveComponent")) return;
			
			//if trickle interactive component, swap for currentModel
			if (model.get("_isTrickleInteractiveComponent")) {
				model = currentModel;
			}

			var trickleConfig = this.getModelTrickleConfig(model);
			if (!trickleConfig) return;

			//set interaction complete
			trickleConfig._isLocking = false;
			trickleConfig._isInteractionComplete = true;
			
			//if plugins need to present before the interaction then break
			if (this.isSteplockingWaiting()) return;
			
			//if completion is required and item is not yet complete then break
			if (trickleConfig._stepLocking._isCompletionRequired &&!model.get("_isInteractionComplete")) return;

			Adapt.trigger("trickle:interactionRequired", model);
			
			//if plugins need to present before the next step occurs then break
			if (this.isSteplockingWaiting()) return;

			this.stepComplete(model);
		},

		stepComplete: function(model) {
			this.initializeStep();

			Adapt.trigger('device:resize');

			this.scrollToStep(model);
		},

		scrollToStep: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model);
			if (trickleConfig._autoScroll === false) return;

			var scrollTo = trickleConfig._scrollTo;
			this.relativeScrollTo( model, scrollTo );
		},

		onWrapperResize: function() {
			if (this._stopListeningToResizeEvent == true) return;
			if (this.isFinished()) return;

			this.resizeBodyToCurrentIndex();
		},


		//steplocking wait interface
		initializeSteplockingWait: function() {
			this._waitForPluginsCount = 0;
		},

		onSteplockingWait: function() {
			this._waitForPluginsCount++;
		},

		onSteplockingUnwait: function() {
			this._waitForPluginsCount--;
			if (this._waitForPluginsCount < 0) this._waitForPluginsCount = 0;

			if (this.isFinished()) return;

			var descendant = this.getCurrentStepModel();
			this.checkStepComplete(descendant);
		},

		isSteplockingWaiting: function() {
			return this._waitForPluginsCount > 0;
		},


		//utility functions
		getDescendantsFlattened: function(id, parentFirst) {
			var model = Adapt.findById(id);
			if (model === undefined) return undefined;

			var descendants = [];

			var modelStructureType = StructureType.fromString(model.get("_type"));
			var isLastType = (modelStructureType._level === StructureType.levels);

			if (isLastType) {

				descendants.push(model);

			} else {

				var children = model.getChildren();

				for (var i = 0, l = children.models.length; i < l; i++) {

					var child = children.models[i];

					var modelStructureType = StructureType.fromString(child.get("_type"));
					var isLastType = (modelStructureType._level === StructureType.levels);

					if (isLastType) {

						descendants.push(child);

					} else {

						var subDescendants = this.getDescendantsFlattened(child.get("_id"), parentFirst);
						if (parentFirst == true) descendants.push(child);
						descendants = descendants.concat(subDescendants.models);
						if (parentFirst != true) descendants.push(child);

					}

				}
			}

			return new Backbone.Collection(descendants);
		},

		findRelative: function(model, relativeString) {
			//return a model relative to the specified one

			function parseRelative(relativeString) {
				var type = relativeString.substr(0, _.indexOf(relativeString, " "));
				var offset = parseInt(relativeString.substr(type.length));
				type = type.substr(1);

				/*RETURN THE TYPE AND OFFSET OF THE SCROLLTO
				* "@component +1"  : 
				* {
				*       type: "component",
				*       offset: 1
				* }
				*/
				return { 
					type: type,
					offset: offset
				};
			}

			function getTypeOffset(model) {
				var modelType = StructureType.fromString(model.get("_type"));

				//CREATE HASH FOR MODEL OFFSET IN PARENTS ACCORDING TO MODEL TYPE
				var offsetCount = {};
				for (var i = modelType._level - 1, l = 0; i > l; i--) {
					offsetCount[StructureType.fromInt(i)._id] = -1;
				}

				return offsetCount;
			}

			var fromIndex = this.getModelPageIndex(model);

			var typeOffset = getTypeOffset(model);
			var relativeInstructions = parseRelative(relativeString);

			var descendantsJSON = this._descendantsChildrenFirst.toJSON();
			for (var i = fromIndex +1, l = descendantsJSON.length; i < l; i++) {
				var item = descendantsJSON[i];

				if (!typeOffset[item._type]) typeOffset[item._type] = 0;

				typeOffset[item._type]++;

				if (typeOffset[relativeInstructions.type] >= relativeInstructions.offset) {
					if (!$("."+item._id).is(":visible")) {
						//IGNORE VISIBLY HIDDEN ELEMENTS
						relativeInstructions.offset++;
						continue;
					}

					return Adapt.findById(item._id);
				}
			}

			return undefined;
		},

		relativeScrollTo: function(model, scrollTo) {
			if (scrollTo === undefined) scrollTo = "@block +1";

			var scrollToId = "";
			switch (scrollTo.substr(0,1)) {
			case "@":
				//NAVIGATE BY RELATIVE TYPE
				var relativeModel = this.findRelative(model, scrollTo);
				scrollToId = relativeModel.get("_id");

				break;
			case ".":
				//NAVIGATE BY CLASS
				scrollToId = scrollTo.substr(1, scrollTo.length-1);
				break;
			default: 
				scrollToId = scrollTo;
			}

			if (scrollToId == "") return;
			
			var duration = model.get("_trickle")._scrollDuration || 500;
			_.delay(function() {
				Adapt.scrollTo("." + scrollToId, { duration: duration });
			}, 250);
		}
		
	}, Backbone.Events);

	Trickle.initialize();

	return Trickle;

})
