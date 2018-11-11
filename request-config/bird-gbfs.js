module.exports = {
    getBikes: function (systemAbbreviation) {
        return {
            method: 'GET',
            headers: {},
            url: 'https://gbfs.bird.co/' + systemAbbreviation,
            timeout: 15000,
            json: true
        };
    }
};