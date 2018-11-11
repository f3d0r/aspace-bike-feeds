module.exports = {
    getStationsStatus: function () {
        return {
            method: 'GET',
            headers: {},
            url: 'http://biketownpdx.socialbicycles.com/opendata/station_status.json',
            timeout: 15000,
            json: true
        };
    },
    getStationInfo: function () {
        return {
            method: 'GET',
            headers: {},
            url: 'http://biketownpdx.socialbicycles.com/opendata/station_information.json',
            timeout: 15000,
            json: true
        };
    },
    getFreeBikes: function () {
        return {
            method: 'GET',
            headers: {},
            url: 'http://biketownpdx.socialbicycles.com/opendata/free_bike_status.json',
            timeout: 15000,
            json: true
        };
    }
};