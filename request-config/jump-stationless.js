module.exports = {
    getBikes: function (cityAbbreviation) {
        return {
            method: 'GET',
            url: 'https://' + cityAbbreviation + '.jumpbikes.com/opendata/free_bike_status.json',
            headers: {
            },
            timeout: 5000,
            json: true
        };
    }
}