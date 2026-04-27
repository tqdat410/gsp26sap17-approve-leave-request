/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "com/gsp26/sap17/approveleaverequest/model/models"
    ],
    function (UIComponent, Device, models) {
        "use strict";

        return UIComponent.extend("com.gsp26.sap17.approveleaverequest.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
                this._handleStartupNavigation();
            },

            _handleStartupNavigation: function () {
                if (window.location.hash.indexOf("&/") !== -1) {
                    return;
                }

                var oData = this.getComponentData() || {};
                var oParams = oData.startupParameters || {};
                var sRequestId = this._getStartupParam(oParams, "RequestID") || this._getStartupParam(oParams, "RequestId");
                if (!sRequestId) {
                    return;
                }

                sRequestId = this._normalizeGuid(sRequestId);

                this.getRouter().navTo("RouteDetail", { requestId: sRequestId }, true);
            },

            _getStartupParam: function (oParams, sName) {
                return (oParams[sName] && oParams[sName][0]) || "";
            },

            _normalizeGuid: function (s) {
                if (!s) {
                    return s;
                }
                if (s.length === 32) {
                    return s.substr(0, 8) + "-" + s.substr(8, 4) + "-" + s.substr(12, 4) + "-" + s.substr(16, 4) + "-" + s.substr(20);
                }
                return s;
            }
        });
    }
);
