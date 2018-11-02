module.exports = {
    getBikes: function (lat, lng) {
        return {
            method: 'GET',
            url: 'https://mwx.mobike.com/mobike-api/rent/nearbyBikesInfo.do',
            qs: {
                latitude: lat,
                longitude: lng
            },
            headers: {},
            timeout: 5000,
            json: true
        };
    }
}