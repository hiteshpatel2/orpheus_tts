import wavify from "./wavify";
import concat from "./concat";
// import EventEmitter from "events";

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

// const pad = buffer => {
//     const currentSample = new Float32Array(1);

//     buffer.copyFromChannel(currentSample, 0, 0);

//     let wasPositive = currentSample[0] > 0;

//     for (let i = 0; i < buffer.length; i += 1) {
//         buffer.copyFromChannel(currentSample, 0, i);

//         if ((wasPositive && currentSample[0] < 0) || (!wasPositive && currentSample[0] > 0)) {
//             break;
//         }

//         currentSample[0] = 0;
//         buffer.copyToChannel(currentSample, 0, i);
//     }

//     buffer.copyFromChannel(currentSample, 0, buffer.length - 1);

//     wasPositive = currentSample[0] > 0;

//     for (let i = buffer.length - 1; i > 0; i -= 1) {
//         buffer.copyFromChannel(currentSample, 0, i);

//         if ((wasPositive && currentSample[0] < 0) || (!wasPositive && currentSample[0] > 0)) {
//             break;
//         }

//         currentSample[0] = 0;
//         buffer.copyToChannel(currentSample, 0, i);
//     }

//     return buffer;
// };

// new WavPlayer wasn't working in vzTpdClient until it was changed to function.
export function WavPlayer() {
    let global_url_list = [];
    let global_total_msgs;
    let currently_playing_index = 0;
    let hasCanceled_ = false;
    // Multi dimensional array to hold audio buffers for each URL that can fetch in parallel.
    let audioStack = [];
    let buffering = [];
    let scheduleBuffersTimeoutId = [];
    let lastEndedSourceId = null;
    let nextTime = [];
    let audioContext = [];
    

    const playAll = (url_list) => {
        global_url_list = url_list;
        global_total_msgs = url_list.length;
        currently_playing_index = 0;
        // Play the first URL stream. (index = 0)
        play(global_url_list[currently_playing_index], currently_playing_index);
    }

    const play = async (url, url_index) => {
        // console.log('fetching..', url);
        nextTime[url_index] = 0;
        buffering[url_index] = true;
        audioContext[url_index] = new AudioContext();
        hasCanceled_ = false;

        

        scheduleBuffersTimeoutId[url_index] = null;

        const scheduleBuffers = (msg_debug) => {
            // console.log('scheduleBuffers called', msg_debug);
            if (scheduleBuffersTimeoutId[currently_playing_index] !== null) {
                // console.log('clearing timeout');
                clearTimeout(scheduleBuffersTimeoutId[currently_playing_index]);
                scheduleBuffersTimeoutId[currently_playing_index] = null;
            }
            if (hasCanceled_) {
                scheduleBuffersTimeoutId[currently_playing_index] = null;

                return;
            }

            let source;

            // if(!buffering[currently_playing_index]) {
            //     console.log('Currrent Playing Index', currently_playing_index);
            //     console.log('Stack length', audioStack[currently_playing_index].length);
            //     console.log('Buffer Value', audioStack[currently_playing_index][0].buffer);
            //     console.log('Time diff: ', context.currentTime - nextTime)
            // }
            // console.log('audioStack[currently_playing_index].length', audioStack[currently_playing_index].length, ', nextTime', nextTime[currently_playing_index], ', audioContext[currently_playing_index].currentTime', audioContext[currently_playing_index].currentTime, 'currently_playing_index', currently_playing_index)
            while (
                audioStack[currently_playing_index].length > 0 
                && audioStack[currently_playing_index][0].buffer !== undefined 
                && nextTime[currently_playing_index] < audioContext[currently_playing_index].currentTime + 2
            ) {
                const currentTime = audioContext[currently_playing_index].currentTime;

                source = audioContext[currently_playing_index].createBufferSource();

                const segment = audioStack[currently_playing_index].shift();

                // This following line was causing stuttering now it is commented out. But it works fine for example wav
                // source.buffer = pad(segment.buffer);
                source.buffer = segment.buffer;
                source.connect(audioContext[currently_playing_index].destination);
                source.id = getRandomInt(1000, 9999);

                if (nextTime[currently_playing_index] == 0) {
                    nextTime[currently_playing_index] = currentTime + 0.5; /// add 700ms latency to work well across systems - tune this if you like
                }

                let duration = source.buffer.duration;
                let offset = 0;

                if (currentTime > nextTime[currently_playing_index]) {
                    offset = currentTime - nextTime[currently_playing_index];
                    nextTime[currently_playing_index] = currentTime;
                    duration = duration - offset;
                }

                source.start(nextTime[currently_playing_index], offset);
                source.stop(nextTime[currently_playing_index] + duration);

                nextTime[currently_playing_index] += duration; // Make the next buffer wait the length of the last buffer before being played
                // console.log('buffering...', currentTime, nextTime);
                // console.log(duration)
                // console.log('buffering[currently_playing_index]', buffering[currently_playing_index], 'length', audioStack[currently_playing_index].length);
                if(buffering[currently_playing_index] == false && audioStack[currently_playing_index].length == 0) {
                    return setAudioSpeechEndEvent(source);
                }
            }
            
            // console.log('AudioContext state in ScheduleBuffer', context.state);
            if (audioStack[currently_playing_index].length > 0) {
                scheduleBuffersTimeoutId[currently_playing_index] = setTimeout(scheduleBuffers, 500, 'setTimeout event');
                // console.log('scheduling Buffer');
            } else {
                // scheduleBuffersTimeoutId[currently_playing_index] = null;
                // // console.log('No more buffers, stopping scheduling');
                // if(buffering[currently_playing_index] == false) {
                //     nextStream();
                // }
            }
            // console.log('cpi, bufferingStatus, audiostack size', currently_playing_index, buffering[currently_playing_index], audioStack[currently_playing_index].length);
        };

        const nextStream = () => {
            currently_playing_index += 1;
            nextTime[currently_playing_index] = 0;
            if(currently_playing_index === global_total_msgs) {
                // console.log('Streaming Buffer speech ended for LAST URL time to activate mic, Incremented CPI, Total_msgs', currently_playing_index, global_total_msgs);
                // Activate the mic
                document.getElementById('ai-widget').click();  
                return  
            } else {
                // play(global_url_list[currently_playing_index]);
                console.log('Next audio stream should be played');
                // console.log('currently_playing_index', currently_playing_index);
                scheduleBuffersTimeoutId[currently_playing_index] = null;
                // Schedule Buffers if currently playing index has stopped buffering.
                if (buffering[currently_playing_index] == false) {
                    scheduleBuffers('from nextStream');
                }
                // scheduleBuffersTimeoutId = setTimeout(scheduleBuffers, 500);
            }
        }

        const setAudioSpeechEndEvent = (source) => {
            // Should be last buffer so add Event listener when speech ends.
            // To ensure addition of event is not called multiple times.
            console.log('inside setAudioSpeechEndEvent', source.id);
            source.addEventListener("ended", (event) => {
                // console.log('inside ended, cpindx, ', currently_playing_index, event);
                if(lastEndedSourceId !== event.target.id) {  
                    lastEndedSourceId = source.id;
                    return nextStream();
                }
                
                // return nextStream();
            });
            // console.log('Speech Buffer completed, last buffer');
        }

        await fetch(url).then(response => {
            console.log('fetching url index',url_index, ', url', url);
            const reader = response.body.getReader();
            buffering[url_index] = true;
            audioStack[url_index] = [];

            // This variable holds a possibly dangling byte.
            var rest = null;

            let isFirstBuffer = true;
            let numberOfChannels, sampleRate;

            const read = async () =>
                await reader.read().then(async ({ value, done }) => {
                    if (hasCanceled_) {
                        reader.cancel();
                        return;
                    }
                    if (value && value.buffer) {
                        let buffer, segment;

                        if (rest !== null) {
                            buffer = concat(rest, value.buffer);
                        } else {
                            buffer = value.buffer;
                        }

                        // Make sure that the first buffer is lager then 44 bytes.
                        if (isFirstBuffer && buffer.byteLength <= 44) {
                            rest = buffer;

                            read();

                            return;
                        }

                        // If the header has arrived try to derive the numberOfChannels and the
                        // sampleRate of the incoming file.
                        if (isFirstBuffer) {
                            isFirstBuffer = false;

                            const dataView = new DataView(buffer);

                            numberOfChannels = dataView.getUint16(22, true);
                            sampleRate = dataView.getUint32(24, true);

                            buffer = buffer.slice(44);
                        }

                        if (buffer.byteLength % 2 !== 0) {
                            rest = buffer.slice(-2, -1);
                            buffer = buffer.slice(0, -1);
                        } else {
                            rest = null;
                        }

                        segment = {};


                        audioStack[url_index].push(segment);                        
                        // console.log('AudioContext state in Fetch', context.state);
                        // console.log('Pushing to audioStack index: ', url_index ,audioStack[url_index].length);
                        // console.log('Currently Playing Index: ', currently_playing_index);
                        audioContext[url_index]
                            .decodeAudioData(wavify(buffer, numberOfChannels, sampleRate))
                            .then(audioBuffer => {
                                segment.buffer = audioBuffer;
                                // Start with a minimum # of buffers in the stack
                                // If the buffers are too small, the audio may stop playing
                                // Only play first URL stream, rest should be played sequentially and must be handled under scheduleBuffers function.
                                // if(currently_playing_index > 0) {
                                //     console.log('scheduleBuffersTimeoutId[url_index] ', scheduleBuffersTimeoutId[url_index] , 'url_index', url_index, 'currently_playing_index', currently_playing_index, 'audioStack[url_index].length', audioStack[url_index].length);
                                // }
                                if (scheduleBuffersTimeoutId[url_index] === null && currently_playing_index == url_index && audioStack[url_index].length > 0) {
                                    scheduleBuffers('from fetch decodeAudioData');
                                } 
                                // else if(url_index > currently_playing_index && audioStack[currently_playing_index].length > 0 && buffering[currently_playing_index] == false) {
                                //     console.log('Fetching URL AudioContext', audioContext[url_index].state);
                                //     console.log('Finish speech from previous URL, currently playing AudioContxt', audioContext[currently_playing_index].state);
                                // }
                            });
                    }

                    if (done) {
                        // Audio stream finished and now it's finishing speaking last remaining buffers
                        console.log('audio stream finished for url index: ', url_index);
                        buffering[url_index] = false;
                        // scheduleBuffers('after audio stream finished');
                        if(currently_playing_index == url_index) {
                            if (audioStack[url_index].length == 0) {
                                console.log('Currently playing index is same as url index although audioStack is already finished speaking, calling nextStream');
                                nextStream();
                            } else {
                                console.log('Buffering finished but need to finish speaking');
                                scheduleBuffers('Finish current speech stream');
                            }
                        }
                        // Start fetching the new URL stream if it is not the last URL stream.
                        if (url_index < global_total_msgs - 1) {
                            console.log('Currently playing index is less than total messages fetch next stream');
                            play(global_url_list[url_index + 1], url_index + 1);
                        }
                        return reader.releaseLock();
                    }

                    // continue reading
                    read();
                });

            // start reading
            read();
        });
    };

    return {
        playAll: (url_list) => playAll(url_list),
        play: (url) => play(url),
        stop: () => {
            hasCanceled_ = true;
            audioContext.forEach((_context) => {
                if (_context && _context.state === "running") {
                    _context.suspend();
                    _context.close();
                }
            })
            
        }
    };
};
