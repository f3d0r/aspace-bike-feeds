module.exports = {
    getBikes: function (region) {
        return {
            method: 'GET',
            url: 'https://lime.bike/api/partners/v1/bikes',
            qs: {
                region: region
            },
            headers: {
                authorization: 'Bearer limebike-PMc3qGEtAAXqJa'
            },
            json: true
        };
    }
}
