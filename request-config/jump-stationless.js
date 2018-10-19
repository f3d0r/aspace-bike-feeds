module.exports = {
    getBikes: function (cityAbbreviation) {
        return {
            method: 'GET',
            url: 'https://' + cityAbbreviation + '.jumpbikes.com/opendata/free_bike_status.json',
            headers: {
                'user-agent': 'insomnia/6.0.2'
            },
            json: true
        };
    }
}