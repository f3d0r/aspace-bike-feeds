const Bird = require('../')
const bird = new Bird();

let RATE_LIMIT_BASE = 100; //100ms separation

const prompt = require("prompt-async");

async function init() {
    try {
        await bird.login('me@f3d0r.com')
        prompt.start();
        const {
            verifyCode
        } = await prompt.get(['verifyCode']);
        var email = await bird.verifyEmail(verifyCode)
        var reqs = [];
        for (var index = 1; index <= 300; index++) {
            reqs.push(bird.getScootersNearby(45.512794, -122.679565, 5000));
        }
        Promise.all(reqs)
            .then(function (responses) {
                var index = 0
                responses.forEach(function (response) {
                    console.log(response.length + "\t" + index++);
                });
            })
            .catch(function (error) {
                throw error;
            })
    } catch (err) {
        console.log(err)
    }
}

init();