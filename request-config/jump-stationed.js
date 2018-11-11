module.exports = {
    getStationsStatus: function (systemPrefix, isJumpMobility = false) {
        var firstUrlPart = '.jumpbikes.com';
        if (isJumpMobility) {
            firstUrlPart = '.jumpmobility.com';
        }
        return {
            method: 'GET',
            headers: {},
            url: 'https://' + systemPrefix + firstUrlPart + '/opendata/station_status.json',
            timeout: 15000,
            json: true
        };
    },
    getStationInfo: function (systemPrefix, isJumpMobility = false) {
        var firstUrlPart = '.jumpbikes.com';
        if (isJumpMobility) {
            firstUrlPart = '.jumpmobility.com';
        }
        return {
            method: 'GET',
            headers: {},
            url: 'https://' + systemPrefix + firstUrlPart + '/opendata/station_information.json',
            timeout: 15000,
            json: true
        };
    },
    getFreeBikes: function (systemPrefix, isJumpMobility = false) {
        var firstUrlPart = '.jumpbikes.com';
        if (isJumpMobility) {
            firstUrlPart = '.jumpmobility.com';
        }
        return {
            method: 'GET',
            headers: {},
            url: 'https://' + systemPrefix + firstUrlPart + '/opendata/free_bike_status.json',
            timeout: 15000,
            json: true
        };
    }
};