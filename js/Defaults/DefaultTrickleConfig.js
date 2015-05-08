define(function() {
	var DefaultTrickleConfig = {
		_isEnabled: false,
		_duration: 500,
		_autoScroll: true,
		_button: {
			_isEnabled: true,
			_isFullWidth: true,
			_styleBeforeCompletion: "visible",
			_styleAfterClick: "hidden",
			_autoHide: false,
			text: "Continue",
			_component: "trickle-button"
		},
		_stepLocking: {
	        _isEnabled: true, 
	        _isCompletionRequired: true,
	        _isLockedOnRevisit: true
	    },
	    _isInteractionComplete: false,
	    _scrollTo: "@block +1"
	};
	return DefaultTrickleConfig;
})