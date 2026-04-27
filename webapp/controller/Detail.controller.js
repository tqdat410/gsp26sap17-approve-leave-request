sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/m/MessageBox",
        "sap/m/MessageToast",
        "sap/ui/core/Fragment",
        "sap/base/security/encodeXML",
        "com/gsp26/sap17/approveleaverequest/model/formatter"
    ],
    function (Controller, MessageBox, MessageToast, Fragment, encodeXML, formatter) {
        "use strict";

        return Controller.extend("com.gsp26.sap17.approveleaverequest.controller.Detail", {
            formatter: formatter,

            onInit: function () {
                this.oRouter = this.getOwnerComponent().getRouter();
                this.oRouter
                    .getRoute("RouteDetail")
                    .attachPatternMatched(this._onObjectMatched, this);
            },

            _onObjectMatched: function (oEvent) {
                var sRequestId = oEvent.getParameter("arguments").requestId;
                var sPath = "/LeaveRequest(RequestID=" + sRequestId + ")";

                this.getView().bindElement({
                    path: sPath,
                    parameters: {
                        $$updateGroupId: "detailGroup"
                    }
                });
            },

            onNavBack: function () {
                this.oRouter.navTo("RouteMain");
            },

            // Refresh detail after an action
            _refreshDetail: function () {
                var oContext = this.getView().getBindingContext();
                if (oContext) {
                    var sPath = oContext.getPath();
                    this.getView().bindElement({
                        path: sPath,
                        parameters: {
                            $$updateGroupId: "detailGroup"
                        }
                    });
                }
            },

            onApprove: function () {
                var oContext = this.getView().getBindingContext();
                var sEmployeeId = oContext.getProperty("EmployeeID");
                var sLeaveType = oContext.getProperty("LeaveType");
                var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                MessageBox.confirm(
                    oResourceBundle.getText("confirmApprove", [sEmployeeId, sLeaveType]),
                    {
                        title: oResourceBundle.getText("approveTitle"),
                        onClose: function (oAction) {
                            if (oAction === MessageBox.Action.OK) {
                                this._executeApprove(oContext);
                            }
                        }.bind(this)
                    }
                );
            },

            _executeApprove: function (oContext) {
                var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                this.getView().setBusy(true);
                this._clearMessages();

                // Invoke OData V4 action
                var oActionBinding = oContext.getModel().bindContext(
                    oContext.getPath() +
                        "/com.sap.gateway.srvd.z17_sd_leaverequest.v0001.Approve(...)",
                    oContext
                );

                oActionBinding
                    .execute()
                    .then(
                        function () {
                            this.getView().setBusy(false);
                            var sBackendMessage = this._getBackendMessageText(oContext, [
                                "Success",
                                "Information"
                            ]);
                            MessageToast.show(
                                sBackendMessage || oResourceBundle.getText("approveSuccess")
                            );
                            this._refreshDetail();
                        }.bind(this)
                    )
                    .catch(
                        function (oError) {
                            this.getView().setBusy(false);
                            // Sanitize error message to prevent XSS
                            var sMessage = oError.message || oResourceBundle.getText("approveError");
                            MessageBox.error(sMessage);
                        }.bind(this)
                    );
            },

            /**
             * Called when the reject button is pressed
             * @param {sap.ui.base.Event} oEvent The press event
             */
            onReject: function (oEvent) {
                var oContext = oEvent.getSource().getBindingContext();
                this._selectedContext = oContext;

                this._openRejectDialog();
            },

            /**
             * Opens the reject dialog
             * @private
             */
            _openRejectDialog: function () {
                var oView = this.getView();

                if (!this._oRejectDialog) {
                    Fragment.load({
                        id: oView.getId(),
                        name: "com/gsp26/sap17/approveleaverequest.fragment.RejectDialog",
                        controller: this
                    })
                        .then(
                            function (oDialog) {
                                this._oRejectDialog = oDialog;
                                oView.addDependent(oDialog);
                                oDialog.open();
                            }.bind(this)
                        )
                        .catch(
                            function (oError) {
                                var oResourceBundle =
                                    this.getView().getModel("i18n").getResourceBundle();
                                MessageBox.error(
                                    oResourceBundle.getText("rejectError") + ": " + oError.message
                                );
                            }.bind(this)
                        );
                } else {
                    // Reset reason textarea
                    this.byId("rejectReasonTextArea").setValue("");
                    this._oRejectDialog.open();
                }
            },

            /**
             * Called when the reject dialog confirm button is pressed
             */
            onRejectDialogConfirm: function () {
                var sReason = this.byId("rejectReasonTextArea").getValue();
                var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                if (!sReason || sReason.trim() === "") {
                    MessageBox.error(oResourceBundle.getText("rejectReasonRequired"));
                    return;
                }

                this._oRejectDialog.close();
                this._executeReject(this._selectedContext, sReason);
            },

            /**
             * Called when the reject dialog cancel button is pressed
             */
            onRejectDialogCancel: function () {
                this._oRejectDialog.close();
            },

            /**
             * Executes the reject action via OData V4
             * @param {sap.ui.model.odata.v4.Context} oContext The row context
             * @param {string} sReason The rejection reason
             * @private
             */
            _executeReject: function (oContext, sReason) {
                var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                this.getView().setBusy(true);
                this._clearMessages();

                // Invoke OData V4 action with parameter
                var oActionBinding = oContext.getModel().bindContext(
                    oContext.getPath() +
                        "/com.sap.gateway.srvd.z17_sd_leaverequest.v0001.Reject(...)",
                    oContext
                );

                // Set the rejection reason parameter
                oActionBinding.setParameter("RejectReason", String(sReason));

                oActionBinding
                    .execute()
                    .then(
                        function () {
                            this.getView().setBusy(false);
                            var sBackendMessage = this._getBackendMessageText(oContext, [
                                "Success",
                                "Information"
                            ]);
                            MessageToast.show(
                                sBackendMessage || oResourceBundle.getText("rejectSuccess")
                            );
                            this._refreshDetail();
                        }.bind(this)
                    )
                    .catch(
                        function (oError) {
                            this.getView().setBusy(false);
                            // Sanitize error message to prevent XSS
                          var sMessage = oError.message || oResourceBundle.getText("rejectError");
                            MessageBox.error(sMessage);
                        }.bind(this)
                    );
            },

         

            _clearMessages: function () {
                var oMessageManager = sap.ui.getCore().getMessageManager();
                if (oMessageManager) {
                    oMessageManager.removeAllMessages();
                }
            },

            _getBackendMessageText: function (oContext, aPreferTypes) {
                var oMessageManager = sap.ui.getCore().getMessageManager();
                if (!oMessageManager) {
                    return null;
                }

                var aMessages = oMessageManager.getMessageModel().getData() || [];
                if (aMessages.length === 0) {
                    return null;
                }

                var sPath =
                    oContext && oContext.getPath && typeof oContext.getPath === "function"
                        ? oContext.getPath()
                        : "";

                var aScopedMessages = sPath
                    ? aMessages.filter(function (oMessage) {
                          var sTarget =
                              oMessage && oMessage.getTarget && oMessage.getTarget
                                  ? oMessage.getTarget()
                                  : "";
                          return sTarget && (sTarget === sPath || sTarget.indexOf(sPath + "/") === 0);
                      })
                    : [];

                var aPool = aScopedMessages.length ? aScopedMessages : aMessages;
                var aTypes = aPreferTypes && aPreferTypes.length ? aPreferTypes : ["Success"];

                for (var t = 0; t < aTypes.length; t++) {
                    for (var i = aPool.length - 1; i >= 0; i--) {
                        if (aPool[i].getType && aPool[i].getType() === aTypes[t]) {
                            return aPool[i].getMessage ? aPool[i].getMessage() : null;
                        }
                    }
                }

                var oLast = aPool[aPool.length - 1];
                return oLast && oLast.getMessage ? oLast.getMessage() : null;
            },

        
        });
    }
);
