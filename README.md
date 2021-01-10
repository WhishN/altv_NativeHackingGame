Features
==
- Create your own native hacking game from original GTA
- Customizable Lives, and rotation speed to adjust difficulty

How to use:
---
Download the class and put it into your existing client resource
Import the file in your client code.

Start the game:
---
```javascript
/** 
 * Trigger a new hacking Game if none is runnning
 * @param {string} word 8 Char string that will be the Solution 
 * @param {number} lives [OPTIONAL] Number of lives. Default 3 
 * @param {number} minSpeed [OPTIONAL] minimum Rotation Speed of column - Default 10
 * @param {number} maxSpeed [OPTIONAL] maximum Rotation Speed of column. Default 100
 * @returns {boolean} false if game is already running
 */
 alt.emit("HackingGame:Start", word, lives, minSpeed, maxSpeed);
```
Get the game result:
---
Once done the game will send a reply emit to your code that you can get with:
```javascript
alt.on("HackingGame:Result", (result) => {
	/*	Result is a boolean
	 * 	true: Player finished the Hack
	 * 	false: Player failed the Hack
	 */
});
```
Original Source:
===
Repo: [GTA Chaos Mod](https://github.com/gta-chaos-mod/ChaosModV/blob/master/ChaosMod/Effects/db/Player/PlayerHacking.cpp "GTA Chaos Mod") Author: [DrUnderscore](https://github.com/drunderscore "DrUnderscore")
