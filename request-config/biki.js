module.exports = {
    getStationsStatus: function () {
        return {
            method: 'GET',
            headers: {},
            url: 'https://hon.publicbikesystem.net/ube/gbfs/v1/en/station_status',
            timeout: 15000,
            json: true
        };
    },
    getStationInfo: function () {
        return {
            method: 'GET',
            headers: {},
            url: 'https://hon.publicbikesystem.net/ube/gbfs/v1/en/station_information',
            timeout: 15000,
            json: true
        };
    }
}