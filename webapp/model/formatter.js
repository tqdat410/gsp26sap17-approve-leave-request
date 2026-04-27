sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Formats status code to UI5 ValueState
         * @param {string} sStatus - Status code (N, P, A, R, C)
         * @returns {string} ValueState (Warning, Information, Success, Error, None)
         */
        formatStatusState: function (sStatus) {
            var mStatusState = {
                "SUBMITTED": "Information",  // Submitted - Blue
                "APPROVED": "Success",      // Approved - Green
                "REJECTED": "Error"         // Rejected - Red
            };
            return mStatusState[sStatus] || "None";
        },

    
        /**
         * Formats leave type code to human-readable text
         * @param {string} sType - Leave type code (AL, SL, ML, OL)
         * @returns {string} Leave type text
         */
        formatLeaveTypeText: function (sType) {
            var mTypeText = {
                "AL": "Annual Leave",
                "SL": "Sick Leave",
                "ML": "Maternity Leave",
                "OL": "Others"
            };
            return mTypeText[sType] || sType;
        },

        /**
         * Formats days count to integer (no decimals)
         * @param {string|number} vDays - Days count
         * @returns {string} Formatted days
         */
        formatDays: function (vDays) {
            if (vDays === null || vDays === undefined) {
                return "0";
            }
            return parseInt(vDays, 10).toString();
        },


    formatStatusText: function (sStatus) {
    var mStatusText = {
        "SUBMITTED": "Submitted",
        "APPROVED": "Approved",
        "REJECTED": "Rejected"
    };
    return mStatusText[sStatus] || sStatus;
},
        /**
         * Formats date time string to display format
         * @param {string|Date} vDate - Date value
         * @returns {string} Formatted date time
         */
        formatDateTime: function (vDate) {
            if (!vDate) {
                return "";
            }
            var oDate = vDate instanceof Date ? vDate : new Date(vDate);
            if (isNaN(oDate.getTime())) {
                return vDate; // Return raw if parse fail
            }
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm"
            });
            return oDateFormat.format(oDate);
        }
    };
});