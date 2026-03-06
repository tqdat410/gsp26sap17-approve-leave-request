sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/base/security/encodeXML",
    "com/gsp26/sap17/approveleaverequest/model/formatter"
], function (Controller, MessageBox, MessageToast, Fragment, encodeXML, formatter) {
    "use strict";


    return Controller.extend("com.gsp26.sap17.approveleaverequest.controller.Detail", {

        formatter: formatter,


        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
},


       _onObjectMatched: function (oEvent) {
         var sRequestId = oEvent.getParameter("arguments").requestId;
         var sPath;

    
          sPath = "/LeaveRequest(RequestID=" + sRequestId + ",IsActiveEntity=true)";

         this.getView().bindElement({
        path: sPath,
        parameters: {
        
            $$updateGroupId: 'detailGroup' 
        }
    });
 },


            onNavBack: function () {
                this.oRouter.navTo("RouteMain");
            },

                /* REFRESH DETAIL AFTER ACTION */
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
                        title : oResourceBundle.getText("approveTitle"),
                        onClose: function (oAction) {
                            if (oAction === MessageBox.Action.OK) {
                                this._executeApprove(oContext);
                            }
                    }   .bind(this)
                    }
                 );
            },
                  _executeApprove: function (oContext) {
            var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            this.getView().setBusy(true);

            //Invoke Odata V4 action
             var oActionBinding = oContext.getModel().bindContext(
                oContext.getPath() + "/com.sap.gateway.srvd.z17_sd_leaverequest.v0001.Approve(...)",
                oContext
            );

            oActionBinding.execute().then(function () {
                this.getView().setBusy(false);
                MessageToast.show(oResourceBundle.getText("approveSuccess"));
                this._refreshDetail();
                }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                // Sanitize error message to prevent XSS
                var sMessage = oError.message
                    ? encodeXML(oError.message)
                    : oResourceBundle.getText("approveError");
                MessageBox.error(sMessage);
            }.bind(this));
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
                }).then(function (oDialog) {
                    this._oRejectDialog = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.open();
                }.bind(this)).catch(function (oError) {
                    var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                    MessageBox.error(oResourceBundle.getText("rejectError") + ": " + oError.message);
                }.bind(this));
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

            // Invoke OData V4 action with parameter
            var oActionBinding = oContext.getModel().bindContext(
                oContext.getPath() + "/com.sap.gateway.srvd.z17_sd_leaverequest.v0001.Reject(...)",
                oContext
            );

            // Set the rejection reason parameter
            oActionBinding.setParameter("RejectReason", String(sReason));

            oActionBinding.execute().then(function () {
                this.getView().setBusy(false);
                MessageToast.show(oResourceBundle.getText("rejectSuccess"));
                this._refreshDetail();
            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                // Sanitize error message to prevent XSS
                var sMessage = oError.message
                    ? encodeXML(oError.message)
                    : oResourceBundle.getText("rejectError");
                MessageBox.error(sMessage);
            }.bind(this));
        },


         /**
         * Determines if actions are enabled based on status
         * @param {string} sStatus The status code
         * @returns {boolean} True if actions are enabled
         */
        isActionEnabled: function (sStatus) {
            return sStatus === "N"; // Only enable for 'Submitted' status
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





                
});