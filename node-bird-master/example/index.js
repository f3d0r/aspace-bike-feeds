const Bird = require('../')
const bird = new Bird()

const prompt = require("prompt-async");


async function init() {
  try {
    await bird.login('me@f3d0r.com')
    prompt.start();
    const {
      verifyCode
    } = await prompt.get(['verifyCode']);
    var email = await bird.verifyEmail(verifyCode)
    console.log("email: " + JSON.stringify(email));
    var scooters = await bird.getScootersNearby(45.512794, -122.679565, 5000);
    console.log("scooter 0: ")
    console.log(scooters[0]);
  } catch (err) {
    console.log(err)
  }
}

init()