/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/gsp26/sap17/alr/approveleaverequest/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
