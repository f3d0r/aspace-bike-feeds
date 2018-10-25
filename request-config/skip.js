module.exports = {
    getBikes: function () {
        return {
            method: 'GET',
            url: 'https://us-central1-waybots-production.cloudfunctions.net/dcFreeBikeStatus',
            headers: {},
            timeout: 5000,
            json: true
        };
    }
}