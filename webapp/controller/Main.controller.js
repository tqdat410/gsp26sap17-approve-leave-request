sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/MessageBox",
        "sap/m/MessageToast",
        "sap/ui/core/Fragment",
        "sap/base/security/encodeXML",
        "com/gsp26/sap17/approveleaverequest/model/formatter"
    ],
    function (
        Controller,
        JSONModel,
        Filter,
        FilterOperator,
        MessageBox,
        MessageToast,
        Fragment,
        encodeXML,
        formatter
    ) {
        "use strict";

        return Controller.extend("com.gsp26.sap17.approveleaverequest.controller.Main", {
            formatter: formatter,

            /**
             * Called when the controller is instantiated. It is used to initialize the controller and its view.
             */
            onInit: function () {
                this.oRouter = this.getOwnerComponent().getRouter();
                this.oRouter
                    .getRoute("RouteMain")
                    .attachPatternMatched(this._onPatternMatched, this);

                // View Model for UI state
                var oViewModel = new JSONModel({
                    pendingCount: 0,
                   // selectedRequest: null
                });
                this.getView().setModel(oViewModel, "viewModel");
            },

            /**
             * Called when the route pattern is matched. It is used to perform actions when the user navigates to this view.
             * @private
             */
            _onPatternMatched: function () {
                var oTable = this.byId("approvalTable");
                if (oTable) {
                    var oBinding = oTable.getBinding("items");
                    if (oBinding) {
                        oBinding.refresh();
                        this._applyFilters();
                    }
                }
            },

            /**
             * Updates the pending count in the header
             * @private
             */
            _updatePendingCount: function () {
                var oTable = this.byId("approvalTable");
                if (!oTable) {
                    return;
                }

                var oBinding = oTable.getBinding("items");
                if (!oBinding) {
                    return;
                }

                oBinding
                    .requestContexts(0, Infinity)
                    .then(
                        function (aContexts) {
                            var iPendingCount = aContexts.filter(function (oContext) {
                                return oContext.getProperty("Status") === "SUBMITTED";
                            }).length;

                            this.getView()
                                .getModel("viewModel")
                                .setProperty("/pendingCount", iPendingCount);
                        }.bind(this)
                    )
                    .catch(
                        function (oError) {
                            console.error("Error loading pending count:", oError);
                            this.getView().getModel("viewModel").setProperty("/pendingCount", 0);
                        }.bind(this)
                    );
            },

            onExit: function () {
                if (this._oPendingBinding) {
                    this._oPendingBinding.destroy();
                }
            },

            onFilterChange: function () {
                this._applyFilters();
            },

            _getBaseStatusFilter: function () {
                // Only allow submitted/approved/rejected; hide draft/not-submitted rows.
                return new Filter({
                    filters: [
                        new Filter("Status", FilterOperator.EQ, "SUBMITTED"),
                        new Filter("Status", FilterOperator.EQ, "APPROVED"),
                        new Filter("Status", FilterOperator.EQ, "REJECTED")
                    ],
                    and: false
                });
            },

            /**
             * Called when employee search is triggered
             * @param {sap.ui.base.Event} oEvent The search event
             */
            onEmployeeSearch: function (oEvent) {
                this._applyFilters();
            },

            /**
             * Applies all filters to the table binding
             * @private
             */
            _applyFilters: function () {
                var oTable = this.byId("approvalTable");
                var oBinding = oTable.getBinding("items");
                var aFilters = [this._getBaseStatusFilter()];

                // Status filter
                var sStatus = this.byId("statusFilter").getSelectedKey();
                if (sStatus) {
                    aFilters.push(new Filter("Status", FilterOperator.EQ, sStatus));
                }

                // Date from filter
                var sDateFrom = this.byId("dateFromFilter").getValue();
                if (sDateFrom) {
                    aFilters.push(new Filter("StartDate", FilterOperator.GE, sDateFrom));
                }

                // Date to filter
                var sDateTo = this.byId("dateToFilter").getValue();
                if (sDateTo) {
                    aFilters.push(new Filter("EndDate", FilterOperator.LE, sDateTo));
                }

                // Employee search
                var sEmployeeSearch = this.byId("employeeSearch").getValue();
                if (sEmployeeSearch) {
                    aFilters.push(new Filter("EmployeeID", FilterOperator.Contains, sEmployeeSearch));
                }

                oBinding.filter(
                    new Filter({
                        filters: aFilters,
                        and: true
                    }),
                    "Application"
                );

                this._updatePendingCount();
            },

            onRefresh: function (bSuppressToast) {
                var oTable = this.byId("approvalTable");
                var oBinding = oTable ? oTable.getBinding("items") : null;

                if (oBinding) {
                    oBinding.refresh();
                    this._applyFilters();
                }

                if (bSuppressToast !== true) {
                    MessageToast.show("Update successful");
                }
            },

            /**
             * Called when the approve button is pressed
             * @param {sap.ui.base.Event} oEvent The press event
             */
            onApprovePress: function (oEvent) {
                var oContext = oEvent.getSource().getBindingContext();
                var sEmployeeId = oContext.getProperty("EmployeeID");
                var sLeaveType = oContext.getProperty("LeaveType");
                var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                this._selectedContext = oContext;
                MessageBox.confirm(
                    oResourceBundle.getText("confirmApprove", [sEmployeeId, sLeaveType]),
                    {
                        title: oResourceBundle.getText("approveTitle"),
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                this._executeApprove(oContext);
                            }
                        }.bind(this)
                    }
                );
            },

            /**
             * Executes the approve action via OData V4
             * @param {sap.ui.model.odata.v4.Context} oContext The row context
             * @private
             */
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
                            this.onRefresh(true); // Suppress the "Update successful" toast
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
            onRejectPress: function (oEvent) {
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
                            this.onRefresh(true); // Suppress the "Update successful" toast
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

            /**
             * Determines if actions are enabled based on status
             * @param {string} sStatus The status code
             * @returns {boolean} True if actions are enabled
             */
         //   isActionEnabled: function (sStatus) {
        //        return sStatus === "N";
         //   },

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

            /**
             * Called when a list item is pressed
             * @param {sap.ui.base.Event} oEvent The press event
             */
            onItemPress: function (oEvent) {
                var oItem = oEvent.getSource();
                var oContext = oItem.getBindingContext();
                var sRequestId = oContext.getProperty("RequestID");

                this.oRouter.navTo("RouteDetail", {
                    requestId: sRequestId
                });
            }
        });
    }
);
