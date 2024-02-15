"use strict";

const body = document.body,
    form = document.querySelector('form'),
    svgLabel = form.querySelector('label[for="svg"]'),
    format = form.format,
    optionsPage = document.getElementById('optionsPage');

let initTime, lastFrameNum;

function getSupportedFormatString(container, codecs) {
    for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(`video/${container};codecs=${codec}`)) {
            return `video/${container};codecs=${codec}`;
        }
        if (MediaRecorder.isTypeSupported(`video/${container};codecs=${codec.toUpperCase()}`)) {
            return `video/${container};codecs=${codec.toUpperCase()}`;
        }
    }
    return null;
}

form.svg.onchange = function(event) {
    const [file] = form.svg.files;
    let previewer = document.createElement('img');
    previewer.onload = function() {
        form.width.placeholder = previewer.naturalWidth;
        form.height.placeholder = previewer.naturalHeight;
    }
    previewer.src = URL.createObjectURL(file);
    svgLabel.innerHTML = '';
    svgLabel.appendChild(previewer);
    svgLabel.className = 'choosen';
    optionsPage.className = 'visible';
    optionsPage.style.height = optionsPage.scrollHeight + 'px';

    // Populate formats dropdown
    const allContainers = {'Matroska': 'x-matroska', 'WebM': 'webm', 'Ogg': 'ogg', 'MPEG-4': 'mp4', 'MPEG-2': 'mpeg', 'QuickTime': 'quicktime'};
    const allCodecs = {'AV1': ['av1'], 'VP9': ['vp9', 'vp9.0'], 'VP8': ['vp8', 'vp8.0'], 'H.265': ['hevc', 'h265', 'h.265'], 'H.264': ['avc1', 'h264', 'h.264'], 'Theora': ['theora', 'ogg', 'theo']};

    const testCanvas = document.createElement('canvas');
    let hasOption = false;
    // Add video export formats
    if (typeof(testCanvas.captureStream) === "function") {
        let formatString;
        for (const codec in allCodecs) {
            for (const container in allContainers) {
                formatString = getSupportedFormatString(allContainers[container], allCodecs[codec]);
                if (formatString !== null) {
                    hasOption = true;
                    const option = document.createElement('option');
                    option.value = formatString;
                    option.textContent = `${container} + ${codec}`;
                    format.appendChild(option);
                }
            }
        }
    }
    // Add image sequence format
    if (typeof(testCanvas.toBlob) === "function") {
        hasOption = true;
        const option = document.createElement('option');
        option.value = 'image/png';
        option.textContent = 'PNG Sequence';
        format.appendChild(option);
    }

    if (!hasOption) {
        format.disabled = true;
        alert('Your browser does not support any of the required features to record canvas data. Please use a different or more up-to-date browser.');
    }

    // TODO: read the canvas sources
    // TODO: get the canvas width and height to set the attributes in the in the SVG node (see https://stackoverflow.com/a/28692538)
    // TODO: get the animation duration
}

form.onsubmit = function (event) {
    // validate form
    const errors = validateForm();
    if (errors.length)
        console.error(errors);
    if (!errors.length) {
        /**
         * @type {File}
         */
        const file = form.svg.files[0];
        // start record
        startRecord({
            url: URL.createObjectURL(file),
            width: parseInt(form.width.value || form.width.placeholder),
            height: parseInt(form.height.value || form.height.placeholder),
            duration: parseInt(form.duration.value || form.duration.placeholder),
            framerate: parseInt(form.framerate.value || form.framerate.placeholder),
            background: form.background.value,
            format: form.format.value
        }).then(function(blob) {
            if (form.format.value.startsWith('video/')) {
                const containerExtensions = {'x-matroska': 'mkv', 'webm': 'webm', 'ogg': 'ogv', 'mp4': 'mp4', 'mpeg': 'mpg', 'quicktime': 'mov'};
                saveAs(blob, file.name.replace(/\.svgz?$/i, '.' + containerExtensions[form.format.value.split(';')[0].split('/')[1]]));
            }
            else if (form.format.value.startsWith('image/')) {
                const blobs = blob;
                // Create a new instance of JSZip
                const zip = new JSZip();

                let droppedFrames = 0;
                let lastFrame = null;

                // Iterate over the array of PNG blobs
                for (let i = 0; i < blobs.length; i++) {
                    // Create a new file name for each PNG image
                    const fileName = `${i}.png`;

                    if (typeof(blobs[i]) !== 'undefined') {
                        // Add the PNG blob to the zip file
                        lastFrame = blobs[i];
                        zip.file(fileName, lastFrame);
                    }
                    else {
                        zip.file(fileName, lastFrame);
                        droppedFrames++;
                    }
                }

                console.log("Dropped frames:", droppedFrames);

                // Generate the zip file asynchronously
                zip.generateAsync({ type: "blob" }).then(function (content) {
                    // Save the zip file using saveMe
                    saveAs(content, file.name.replace(/\.svgz?$/i, '.zip'));
                });
            }
        });
    }

    // prevent form submit
    event.preventDefault();
    event.stopPropagation();
    return;
}

form.width.onchange = form.height.onchange = function(e) {
    const current = e.currentTarget;
    if (form["link-dimensions"].checked) {
        const other = current==form.width ? form.height : form.width;
        const ratio = parseInt(current.value) / parseInt(current.previousValue || current.placeholder);
        other.value = Math.round(parseInt(other.value || other.placeholder) * ratio);
    }
    storeValue(current);
}

form.width.onfocus = form.height.onfocus = function(e) {
    storeValue(e.currentTarget);
}

/**
 * @param {HTMLInputElement} input
 */
function storeValue(input) {
    input.previousValue = input.value;
}

/**
 * Validate the form
 * @returns Validation errors
 */
function validateForm() {
    const errors = [];
    // check file selected
    if (!form.svg.files.length)
        errors.push({
            field: 'svg',
            message: 'No file selected'
        });
    // check width and height
    if (form.width.value && !checkPositifInt(form.width.value))
        errors.push({
            field: 'width',
            message: 'The width is not a valid number'
        });
    if (form.height.value && !checkPositifInt(form.height.value))
        errors.push({
            field: 'height',
            message: 'The height is not a valid number'
        });
    // check duration
    if (form.duration.value && !checkPositifInt(form.duration.value))
        errors.push({
            field: 'duration',
            message: 'The duration is not a valid number'
        });
    // check framerate
    if (form.framerate.value && !checkPositifInt(form.framerate.value))
        errors.push({
            field: 'framerate',
            message: 'The framerate is not a valid number'
        });
    // check background
    if (!form.background.value)
        errors.push({
            field: 'background',
            message: 'The background color must be defined'
        });
    else if (!/^#[a-fA-F0-9]{6}$/.test(form.background.value))
        errors.push({
            field: 'background',
            message: `The background value is not a valid color: ${form.background.value}`
        });
    return errors;
}

/**
 * Check if the given string is a valid integer over zero
 * @param {string} val The string to check
 * @returns true if it's a valid number
 */
function checkPositifInt(val) {
    return /^[1-9]\d*$/.test(val);
}

/**
 * Start recording with the given options
 * @param {any} options Recording options
 * @returns {Promise<Blob>} The recoreded video blob
 */
function startRecord(options) {
    return new Promise(function(resolve, reject) {
        console.log('startRecord', options);
        if (body.className)
            return reject(new Error("It's already recording"));

        body.className = 'recording';
        // create image, canvas and recorder
        const image = document.createElement('img'),
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');
        let frames, chunks, stream, recorder = null;

        initTime = null;
        lastFrameNum = -1;

        canvas.width = image.width = options.width;
        canvas.height = image.height = options.height;
        ctx.fillStyle = options.background;

        body.appendChild(image);
        body.appendChild(canvas);

        if (options.format.startsWith('video/')) {
            chunks = [];
            stream = canvas.captureStream(options.framerate);
            recorder = new MediaRecorder(stream, { mimeType: options.format });

            recorder.ondataavailable = function(event) {
                const blob = event.data;
                if (blob && blob.size) {
                    chunks.push(blob);
                }
            };

            recorder.onstop = function(event) {
                // remove temp components
                body.removeChild(image);
                body.removeChild(canvas);

                body.className = '';

                resolve(new Blob(chunks, { type: options.format }));
            };
        }
        else if (options.format === 'image/png') {
            frames = [];
        }

        // on image loaded start recording
        image.onload = function(event) {
            // Start recording
            renderLoop();
        }
        image.src = options.url;

        /**
         * Loop rendering the canvas
         * @param {number} time The loop time
         */
        function renderLoop(time) {
            if (initTime == null) {
                // First call
                if (!time && recorder !== null) {
                    recorder.start();
                }
                else {
                    initTime = time;
                }
            }
            else if (time - initTime > options.duration) {
                // stop recording after defined duration
                if (recorder !== null) {
                    recorder.stop();
                }
                else {
                    resolve(frames);
                }
                return;
            }

            const currentFrameNum = Math.floor((time - initTime) / 1000 * options.framerate);
            if (currentFrameNum > lastFrameNum) {
                render();
                if (recorder === null) {
                    canvas.toBlob(function(blob) {
                        if (blob && blob.size) {
                            frames[currentFrameNum] = blob;
                        }
                    }, options.format);
                }
                lastFrameNum = currentFrameNum;
            }

            requestAnimationFrame(renderLoop);
        }

        /**
         * Render the canvas with the given background and SVG
         */
        function render() {
            ctx.rect(0, 0, options.width, options.height);
            ctx.fill();
            ctx.drawImage(image, 0, 0, options.width, options.height);
        }
    });
}
