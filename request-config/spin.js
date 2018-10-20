module.exports = {
    getBikes: function () {
        return {
            method: 'GET',
            url: 'https://web.spin.pm/api/gbfs/v1/free_bike_status',
            headers: {
            },
            timeout: 5000,
            json: true
        };
    }
}