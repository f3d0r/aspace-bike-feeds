module.exports = {
    getBikes: function () {
        return {
            method: 'GET',
            url: 'https://api.nextbike.net/maps/nextbike-live.json',
            headers: {},
            timeout: 15000,
            json: true
        };
    }
}