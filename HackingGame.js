/// <reference types="@altv/types-client" />
/// <reference types="@altv/types-natives" />

import * as alt from 'alt-client';
import * as natives from 'natives';

const TimerAction = {
    None: 0,
    Reset: 1,
    Remove: 2,
    Kill: 3
}

let ActualHackingGame = null;

alt.on("HackingGame:Start", StartHackingGame);
alt.on("HackingGame:Result", StopHackingGame);

/**
 * Trigger a new hacking Game if none is runnning
 * @param {string} word 8 Char string that will be the Solution 
 * @param {number} lives [OPTIONAL] Number of lives. Default 3 
 * @param {number} minSpeed [OPTIONAL] minimum Rotation Speed of column - Default 10
 * @param {number} maxSpeed [OPTIONAL] maximum Rotation Speed of column. Default 100
 * @returns {boolean} false if game is already running
 */
function StartHackingGame(word, lives = 3, minSpeed = 10, maxSpeed = 100) {
    if(ActualHackingGame !== null) return false;
    ActualHackingGame = new HackingGame(word, lives, minSpeed, maxSpeed);
    ActualHackingGame.Start();
    return true;
}

/**
 * Hacking Game has ended. Clear var
 */
function StopHackingGame(result) {
    ActualHackingGame = null;
    alt.log("Result of Hacking Game => Successfull: "+result);
}

export class HackingGame {
    /**
     * Init The Hacking Game
     * @param {string} word 8 Char string that will be the Solution 
     * @param {number} lives [OPTIONAL] Number of lives. Default 3 
     * @param {number} minSpeed [OPTIONAL] minimum Rotation Speed of column - Default 10
     * @param {number} maxSpeed [OPTIONAL] maximum Rotation Speed of column. Default 100
     */
    constructor(word, lives = 3, minSpeed = 10, maxSpeed = 100) {
        this.Setup = false;
        if(typeof(word) !== "string" || word.length != 8) {
            this._LogError("Constructor word is not word or length != 8");
            return;
        }
        
        if(lives < 1 || lives > 10) {
            this._LogError("Lives must be > 0 and <= 10");
            return;
        }

        if(minSpeed < 10 || maxSpeed > 200 || minSpeed > maxSpeed) {
            this._LogError("Invalid Speed Parameter");
            return;
        }

        this.LivesStart = lives;
        this.ScaleForm = 0;
        this.Timer = 0;
        this.Action = TimerAction.None;
        this.InputReturn = 0;
        this.Finished = false;
        this.Word = word.toUpperCase();
        this.minSpeed = minSpeed;
        this.maxSpeed = maxSpeed;
        this.Setup = true;
        this.Lives = 0;
        this.EveryTick = undefined;
    }

    Start() {
        if(!this.Setup) {
            this._LogError("Not Setup! Check class constructor");
            return;
        }

        if(this.Word === null) {
            this._LogError("Word was null - Did you Setup Correct?");
            return;
        }

        if(this.EveryTick !== undefined) {
            this._LogError("Game is already running!");
            return;
        }

        natives.setPlayerControl(alt.Player.local.scriptID, false, 0);

        this.ScaleForm = natives.requestScaleformMovieInteractive("Hacking_PC");

        this._StartInternal();

        this.Lives = this.LivesStart;
    }

/**
 * 
 * @param {boolean} outcome 
 */
    _Stop(outcome) {
        this._ScaleformRemove();
        natives.setPlayerControl(alt.Player.local.scriptID, true, 0);
        alt.clearEveryTick(this.EveryTick);
        this.EveryTick = undefined;
        alt.emit("HackingGame:Result", outcome)
    }

    _StartInternal(tryNumber = 0) {
        if(!natives.hasScaleformMovieLoaded(this.ScaleForm)) {
            // 2.5 Seconds should be enough?
            if(tryNumber > 100) { 
                this._LogError("Could Not Load Scaleform. Aborting");
                return;
            }

            alt.setTimeout(() => {
                this._StartInternal(++tryNumber);
            },25)
            return;
        }

        natives.beginScaleformMovieMethod(this.ScaleForm, "SET_BACKGROUND");
        natives.scaleformMovieMethodAddParamInt(0);
        natives.endScaleformMovieMethod();

        this._ScaleformRunProgram(4);
        this._ScaleformRunProgram(83);

        this._ScaleformUpdateLives();

        natives.beginScaleformMovieMethod(this.ScaleForm, "SET_ROULETTE_WORD");
        this._ScaleformPushString(this.Word);
        natives.endScaleformMovieMethod();

        for(let i = 0; i < 8; i++) {
            natives.beginScaleformMovieMethod(this.ScaleForm, "SET_COLUMN_SPEED");
            natives.scaleformMovieMethodAddParamInt(i);
            natives.scaleformMovieMethodAddParamFloat(Math.random() * (this.maxSpeed - this.minSpeed) + this.minSpeed);
            natives.endScaleformMovieMethod();
        }

        this.EveryTick = alt.everyTick(() => {
            this._UpdateGame();
        })
    }

    _UpdateGame() {
        natives.drawScaleformMovieFullscreen(this.ScaleForm, 255, 255, 255, 255, 0);
        if(this.Action === TimerAction.None) {
            this._ScaleformCheckInput(32, 172, 8);
            this._ScaleformCheckInput(33, 173, 9);
            this._ScaleformCheckInput(34, 174, 10);
            this._ScaleformCheckInput(35, 175, 11);

            if(natives.isControlJustPressed(2, 201)) {
                natives.beginScaleformMovieMethod(this.ScaleForm, "SET_INPUT_EVENT_SELECT");
                this.InputReturn = natives.endScaleformMovieMethodReturnValue();
            }
        }

        if(this.InputReturn !== 0) {
            if(natives.isScaleformMovieMethodReturnValueReady(this.InputReturn)) {
                switch(natives.getScaleformMovieMethodReturnValueInt(this.InputReturn)) {
                    
                    // Player succeeded in hack
                    case 86: 
                        this.Timer = natives.getGameTimer() + 2000;
                        this.Action = TimerAction.Remove;
                        natives.playSoundFrontend(-1, "HACKING_SUCCESS", 0, 1);
                        natives.beginScaleformMovieMethod(this.ScaleForm, "SET_ROULETTE_OUTCOME");
                        natives.scaleformMovieMethodAddParamBool(true);
                        this._ScaleformPushString("Successful Hacked");
                        natives.endScaleformMovieMethod();
                    break;

                    // Player failed one of the columns (our job to find if they completely failed)
                    case 87: 
                        natives.playSoundFrontend(-1, "HACKING_CLICK_BAD", 0, 1);
                        this.Lives--;
                        if(this.Lives <= 0) {
                            this.Timer = natives.getGameTimer() + 2000;
                            this.Action = TimerAction.Kill;
                            this._ScaleformRemove();
                            natives.playAmbientSpeech1(alt.Player.local.scriptID, "GENERIC_CURSE_HIGH", "SPEECH_PARAMS_FORCE_FRONTEND", 1);
                        } else {
                            this.Timer = natives.getGameTimer() + 500;
                            this.Action = TimerAction.Reset;
                            natives.callScaleformMovieMethod(this.ScaleForm, "STOP_ROULETTE");
                            this._ScaleformUpdateLives();
                        }
                    break;

                    // Properly hit character
                    case 92:
                        natives.playSoundFrontend(-1, "HACKING_CLICK", 0, 1);
                    break;

                }
                this.InputReturn = 0;
            }
        }

        if(this.Action !== TimerAction.None && natives.getGameTimer() >= this.Timer) {
            switch(this.Action) {
                
                case TimerAction.Remove:
                    this._Stop(true);
                break;

                case TimerAction.Reset:
                    this._ScaleformReset();
                break;

                case TimerAction.Kill:
                    this._Stop(false);
                break;
            }

            this.Timer = 0;
            this.Action = TimerAction.None;
        }
    }

    /**
     * 
     * @param {string} msg 
     */
    _LogError(msg) {
        alt.logError(`[HackingGame] ${msg}`);
    }

    /**
     * 
     * @param {string} text 
     */
    _ScaleformPushString(text) {
        natives.beginTextCommandScaleformString("STRING");
        natives.addTextComponentSubstringPlayerName(text);
        natives.endTextCommandScaleformString();
    }

    _ScaleformUpdateLives() {
        natives.beginScaleformMovieMethod(this.ScaleForm, "SET_LIVES");
        natives.scaleformMovieMethodAddParamInt(this.Lives);
        natives.scaleformMovieMethodAddParamInt(2);
        natives.endScaleformMovieMethod();
    }

    /**
     * @param {number} program
     */
    _ScaleformRunProgram(program) {
        natives.beginScaleformMovieMethod(this.ScaleForm, "RUN_PROGRAM");
        natives.scaleformMovieMethodAddParamInt(program);
        natives.endScaleformMovieMethod();
    }

    /**
     * 
     * @param {number} first 
     * @param {number} second 
     * @param {number} input 
     */
    _ScaleformCheckInput(first, second, input) {
        if(natives.isControlJustPressed(2, first) || natives.isControlJustPressed(2, second)) {
            natives.playSoundFrontend(-1, "HACKING_MOVE_CURSOR", 0, 1);
            natives.beginScaleformMovieMethod(this.ScaleForm, "SET_INPUT_EVENT");
            natives.scaleformMovieMethodAddParamInt(input);
            natives.endScaleformMovieMethod();
        }
    }

    _ScaleformRemove() {
        natives.setScaleformMovieAsNoLongerNeeded(this.ScaleForm);
        this.ScaleForm = 0;
        this.Finished = true;
    }

    _ScaleformReset() {
        natives.callScaleformMovieMethod(this.ScaleForm, "RESET_ROULETTE");
    }
}
