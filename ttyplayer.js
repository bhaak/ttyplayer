function TTYPlayer () {
    // Input and pointer to current frame
    var binary = null;
    var ttyrec = null;
    var index = -1;

    // Timeout used while playing the ttyrec.
    var timeout = null;

    // Constants
    var HEIGHT = 24;
    var WIDTH = 80;

    // The buffer itself.
    var buffer = [[]];

    // The spans that correspond to the buffer's cells.
    var frames = {};

    for (var i = 1; i <= HEIGHT; i++) {
        for (var j = 1; j <= WIDTH; j++) { 
            var x = i + '_' + j;
            frames[x] = $('#f' + x);
        }
    }

    // State variables
    var cursor = {
        x: 1, y: 1,
        show: false
    };

    // The graphic rendition
    var span = {
        foreground: 'white',
        background: 'black',
        light: '',
        negative: false
    };

    // The size of the active buffer
    var margins = {
        top: 1,
        bottom: 24
    };

    // Incomplete stuff from the end of a frame
    var pre_pend = '';

    var render_frame = function (string) {
        string = pre_pend + string;
        pre_pend = '';

        var regexp = new RegExp('\\x1b[[]([?]?[0-9;]*)([A-Za-z])');
        var part_regexp = new RegExp('\\x1b([[][?]?[0-9;]*)?');

        var should_print = false;

        var update_lines = {};
        var update_chars = {};

        var output_characters = function (index) {
            var substring = '';

            if (index == -1) {
                substring = string;
                string = '';
            } 
            else {
                substring = string.slice(0, index);
                string = string.slice(index);
            }
            
            var pre = '<span class="';
            if (span.negative == false) {
                pre += span.light + span.foreground + '-fg ' +
                    span.background + '-bg"';
            }
            else {
                pre += span.light + span.foreground + '-bg ' +
                    span.background + '-fg"';
            }
            pre += '>';

            var post = '</span>';

            var j = 0;

            for (var i in substring) {
                i = parseInt(i);

                if (i + j + 1 > substring.length) {
                    break;
                }
                var character = substring[i + j];
                var code = character.charCodeAt(0);

                if (code < 32) {
                    if (code == 8) {
                        // Backspace
                        if (cursor.show) {
                            buffer[cursor.y - 1][cursor.x -1] = undefined;

                            if (update_lines['-1'] == undefined && 
                                update_lines[cursor.y] == undefined) {
                                update_chars[cursor.y + '_' + cursor.x] = true;
                            }
                        }
                        cursor.x--;
                    }
                    else if (code == 10) {
                        // LF
                        buffer.splice(cursor.y, 0, []);
                        buffer.splice(margins.top - 1, 1);

                        if (update_lines['-1'] == undefined) {
                            for (var k = margins.top; k <= cursor.y; k++) {
                                update_lines[k] = true;
                            }
                        }
                    }
                    else if (code == 13) {
                        // CR
                        cursor.x = 1;
                        cursor.y++;

                        if (cursor.y > HEIGHT) {
                            cursor.y = HEIGHT;
                        }

                        if (buffer[cursor.y - 1] == undefined) {
                            buffer[cursor.y - 1] = [];
                        }

                        update_lines[cursor.y] = true;
                    }
                    else if (code == 27) {
                        // ESC
                        var next = substring[i + j + 1];
                        if (next == '7') {
                            console.error('save_cursor');
                            j++;
                        }
                        else if (next == '8') {
                            console.error('restore_cursor');
                            j++;
                        }
                        else if (next == 'M') {
                            // Reverse LF
                            buffer.splice(cursor.y - 1, 0, []);
                            buffer.splice(margins.bottom, 1);

                            if (update_lines['-1'] == undefined) {
                                for (var k = cursor.y; k <= margins.bottom; k++) {
                                    update_lines[k] = true;
                                }
                            }

                            j++;
                        }
                        else {
                            console.error('Unhandled ESC followed by: ' + next);
                        }
                    }
                    else {
                        console.error('Unhandled non-printing character, code: ' + code);
                    }
                }
                else {
                    if (character == ' ') {
                        character = '&nbsp;';
                    }

                    buffer[cursor.y - 1][cursor.x - 1] = pre + character + post;
                    
                    if (update_lines['-1'] == undefined && 
                        update_lines[cursor.y] == undefined) {
                        update_chars[cursor.y + '_' + cursor.x] = true;
                    }

                    cursor.x++;
                }
            }

            should_print = true;
        };

        var handle_esc = function() {

            var init_rows = function(n) {
                for (var i = 0; i < n; i++) {
                    if (buffer[cursor.y + i] == undefined) {
                        buffer[cursor.y + i] = [];
                    }
                }
            };

            var cursor_up = function(n) {
                if (cursor.y == 1) return;
                if (isNaN(n)) n = 1;

                cursor.y -= n;

                if (cursor.y < 1) cursor.y = 1;
            };

            var cursor_down = function(n) {
                if (isNaN(n)) n = 1;

                init_rows(n);
                cursor.y += n;
            };

            var cursor_forward = function(n) {
                if (isNaN(n)) n = 1;

                cursor.x += n;
            };

            var cursor_back = function(n) {
                if (cursor.x == 1) return;
                if (isNaN(n)) n = 1;

                cursor.x -= n;

                if (cursor.x < 1) cursor.x = 1;
            };

            var cursor_next_line = function(n) {
                cursor_down(n);
                cursor.x = 1;
            };

            var cursor_prev_line = function(n) {
                cursor_up(n);
                cursor.x = 1;
            };

            var cursor_horizontal_absolute = function(n) {
                if (isNaN(n)) {
                    console.error('Undefined behaviour for cursor_horizontal_absolute');
                    return;
                }

                cursor.x = n;
            };

            var cursor_position = function(row, column) {
                if (row < cursor.y) {
                    cursor_up(cursor.y - row);
                }
                else if (row > cursor.y) {
                    cursor_down(row - cursor.y);
                }

                cursor.x = column;
            };

            var erase_data = function(n) {
                if (isNaN(n)) n = 0;
                if (n == 0) {
                    // Clear from the cursor to the end of the buffer.
                    buffer[cursor.y - 1].splice(cursor.x - 1);
                    buffer.splice(cursor.y);
                    init_rows(HEIGHT - cursor.y);

                    if (update_lines['-1'] == undefined) {                        
                        if (update_lines[cursor.y] == undefined) {
                            for (var i = cursor.x; i <= WIDTH; i++) {
                                update_chars[cursor.y + '_' + i] = true;                            
                            }
                        }

                        for (var j = cursor.y + 1; j <= HEIGHT; j++) {
                            update_lines[j] = true;
                        }
                    }
                }
                else if (n == 1) {
                    // Clear from the cursor to beginning of buffer.
                    for (var i = 0; i < cursor.y - 1; i++) {
                        buffer[i] = [];
                    }

                    for (var j = 0; j < cursor.x; j++) {
                        buffer[cursor.y - 1][j] = undefined;
                    }

                    if (update_lines['-1'] == undefined) {
                        for (var i = 1; i < cursor.y; i++) {
                            update_lines[i] = true;
                        }

                        if (update_lines[cursor.y] == undefined) {
                            for (var j = 1; j <= cursor.x; j++) {
                                update_chars[cursor.y + '_' + j] = true;
                            }
                        }
                    }
                }
                else if (n == 2) {
                    buffer = [[]];
                    
                    // Moving the cursor might not be the right behaviour.
                    cursor.x = 1;
                    cursor.y = 1;

                    init_rows(HEIGHT - cursor.y);

                    update_lines['-1'] = true;
                }
                else {
                    console.error('Undefined behaviour for erase_data.');
                }
            };

            var erase_in_line = function(n) {
                if (isNaN(n)) n = 0;
                if (n == 0) {
                    buffer[cursor.y - 1].splice(cursor.x - 1);
 
                   if (update_lines['-1'] == undefined &&
                       update_lines[cursor.y] == undefined) {
                       for (var i = cursor.x; i <= WIDTH; i++) {
                           update_chars[cursor.y + '_' + i] = true;
                       }
                   }
                }
                else if (n == 1) {
                    for (var i = 0; i < cursor.x; i++) {
                        buffer[cursor.y - 1][i] = undefined;
                    }

                   if (update_lines['-1'] == undefined &&
                       update_lines[cursor.y] == undefined) {
                       for (var j = 1; j <= cursor.x; j++) {
                           update_chars[cursor.y + '_' + j] = true;
                       }
                   }
                }
                else if (n == 2) {
                    buffer[cursor.y - 1] = [];

                    if (update_lines['-1'] == undefined) {
                        update_lines[cursor.y] = true;
                    }
                }
                else {
                    console.error('Undefined behaviour for erase_in_line.');
                }
            };

            var erase_characters = function(n) {
                for (var i = 0; i < n; i++) {
                    buffer[cursor.y - 1][cursor.x - 1 + i] = undefined;
                }

                if (update_lines['-1'] == undefined &&
                    update_lines[cursor.y] == undefined) {
                    for (var i = 0; i < n; i++) {
                        update_chars[cursor.y + '_' + (cursor.x + i)] = true;
                    }
                }
            };

            var delete_line = function(n) {
                if (isNaN(n)) n = 1;

                buffer.splice(cursor.y - 1, n);

                if (update_lines['-1'] == undefined) {
                    for (var i = 0; cursor.y + i <= HEIGHT; i++) {
                        update_lines[(cursor.y + i)] = true;
                    }
                }

                var offset = HEIGHT - n;
                for (var j = 0; offset + j < HEIGHT; j++) {
                    buffer.push([]);
                }
            };

            var delete_character = function(n) {
                if (isNaN(n)) n = 1;

                buffer[cursor.y - 1].splice(cursor.x - 1, n);

                if (update_lines['-1'] == undefined &&
                    update_lines[cursor.y] == undefined) {
                    for (var i = 0; i <= (WIDTH - cursor.x); i++) {
                        update_chars[cursor.y + '_' + (cursor.x + i)] = true;
                    }
                }

            };

            var insert_line = function(n) {
                if (isNaN(n)) n = 1;

                for (var i = 0; i < n; i++) {
                    buffer.splice(cursor.y - 1, 0, []);                    
                }
                buffer.splice(margins.bottom, n);

                if (update_lines['-1'] == undefined) {
                    for (var k = cursor.y; k <= margins.bottom; k++) {
                        update_lines[k] = true;
                    }
                }
            };

            var select_graphic_rendition = function(value) {
                if (value == '') {
                    span.foreground = 'white';
                    span.background = 'black';
                    span.light = '';
                    span.negative = false;
                }
                else {
                    var values = value.split(';');
                    var l = values.length;
                    for (var i = 0; i < l; i++) {
                        var val = values[i];
                        if (val == '0') {
                            span.foreground = 'white';
                            span.background = 'black';
                            span.light = '';
                            span.negative = false;
                        }
                        else if (val == '1') {
                            span.light = 'light-';
                        }
                        else if (val == '5') {
                            // Blink.
                        }
                        else if (val == '7') {
                            span.negative = true;
                        }
                        else if (val == '30') {
                            span.foreground = 'black';
                        }
                        else if (val == '31') {
                            span.foreground = 'red';
                        }
                        else if (val == '32') {
                            span.foreground = 'green';
                        }
                        else if (val == '33') {
                            span.foreground = 'yellow';
                        }
                        else if (val == '34') {
                            span.foreground = 'blue';
                        }
                        else if (val == '35') {
                            span.foreground = 'magenta';
                        }
                        else if (val == '36') {
                            span.foreground = 'cyan';
                        }
                        else if (val == '37') {
                            span.foreground = 'white';
                        }
                        else if (val == '39') {
                            span.foreground = 'white';
                        }
                        else if (val == '40') {
                            span.background = 'black';
                        }
                        else if (val == '41') {
                            span.background = 'red';
                        }
                        else if (val == '42') {
                            span.background = 'green';
                        }
                        else if (val == '43') {
                            span.background = 'yellow';
                        }
                        else if (val == '44') {
                            span.background = 'blue';
                        }
                        else if (val == '45') {
                            span.background = 'magenta';
                        }
                        else if (val == '46') {
                            span.background = 'cyan';
                        }
                        else if (val == '47') {
                            span.background = 'white';
                        }
                        else if (val == '49') {
                            span.background = 'black';
                        }
                        else {
                            console.error('Unhandled SGR parameter: ' + val);
                        }
                    }
                }
            };

            var set_margins = function(value) {
                var top = 1;
                var bottom = 24;
                if (value != '') {
                    var values = value.split(';');
                    if (values[0] != '') top = parseInt(values[0]);
                    if (values.length == 2) bottom = parseInt(values[1]);
                }

                margins.top = top;
                margins.bottom = bottom;
            };

            var match = string.match(regexp);
            var c = match[2];
            var value = match[1];
            var n = parseInt(value);

            if (c == 'A') {
                cursor_up(n);
            }
            else if (c == 'B') {
                cursor_down(n);
            }
            else if (c == 'C') {
                cursor_forward(n);
            }
            else if (c == 'D') {
                cursor_back(n);
            }
            else if (c == 'E') {
                cursor_next_line(n);
            }
            else if (c == 'F') {
                cursor_prev_line(n);
            }
            else if (c == 'G') {
                cursor_horizontal_absolute(n);
            }
            else if (c == 'H') {
                var x = 1;
                var y = 1;
                if (value != '') {
                    var values = value.split(';');
                    if (values[0] != '') y = parseInt(values[0]);
                    if (values.length == 2) x = parseInt(values[1]);
                }
                cursor_position(y, x);
            }
            else if (c == 'J') {
                erase_data(n);
            }
            else if (c == 'K') {
                erase_in_line(n);
            }
            else if (c == 'L') {
                insert_line(n);
            }
            else if (c == 'M') {
                delete_line(n);
            }
            else if (c == 'P') {
                delete_character(n);
            }
            else if (c == 'S') {
                console.error('scroll_up not defined.');
            }
            else if (c == 'T') {
                console.error('scroll_down not defined.');
            }
            else if (c == 'X') {
                erase_characters(n);
            }
            else if (c == 'd') {
                // Line position absolute
                cursor_position(n, cursor.x);
            }
            else if (c == 'f') {
                var x = 1;
                var y = 1;
                if (value != '') {
                    var values = value.split(';');
                    if (values[0] != '') y = parseInt(values[0]);
                    if (values.length == 2) x = parseInt(values[1]);
                }
                cursor_position(y, x);
            }
            else if (c == 'h' && value == '?25') {
                cursor.show = true;
            }

            else if (c == 'l' && value == '?25') {
                cursor.show = false;
                buffer[cursor.y - 1][cursor.x - 1] = undefined;
                should_print = true;
            }
            else if (c == 'm') {
                select_graphic_rendition(value);
            }
            else if (c == 'r') {
                set_margins(value);
            }
            else {
                console.error('Unhandled escape sequence: ' + match[0]);
            }

            string = string.slice(match[0].length);
        };

        var print_buffer = function () {

            if (update_lines['-1']) {
                
                var m = buffer.length;
                for (var i = 1; i <= m; i++) {
                    for (var j = 1; j <= WIDTH; j++) { 

                        var c = buffer[i - 1][j - 1];
                        if (c == undefined) {
                            c = '<span>&nbsp;</span>';
                        }

                        var f = frames[i + '_' + j];
                        f.html(c);
                    }
                }

                for (var i = 1; i + m <= HEIGHT; i++) {
                    for (var j = 1; j <= WIDTH; j++) { 
                        var f = frames[(i + m) + '_' + j];
                        f.html('<span>&nbsp;</span>');
                    }
                }
            }
            else {
                for (var point in update_chars) {
                    var points = point.split('_');
                    var i = parseInt(points[0]);
                    var j = parseInt(points[1]);

                    // Skip any character that will be covered by a line printing.
                    if (update_lines[i]) {
                        continue;
                    }

                    var c = buffer[i - 1][j - 1];
                    if (c == undefined) {
                        c = '<span>&nbsp;</span>';
                    }

                    var f = frames[i + '_' + j];
                    f.html(c);
                }

                for (var line in update_lines) {
                    var i = parseInt(line);

                    for (var j = 1; j <= WIDTH; j++) {

                        var c = buffer[i - 1][j - 1];
                        if (c == undefined) {
                            c = '<span>&nbsp;</span>';
                        }

                        var f = frames[i + '_' + j];
                        f.html(c);
                    }
                }
            }
        };

        var d = (new Date()).valueOf();

        // Remove shift-in and shift-out, as I have no idea what to do with them.
        string = string.replace(/\x0f/g, '');
        string = string.replace(/\x0e/g, '');

        if (cursor.show) {
            buffer[cursor.y - 1][cursor.x - 1] = '<span>&nbsp;</span>';
            update_chars[cursor.y + '_' + cursor.x] = true;
        }

        while (string != '') {
            var i = string.search(regexp);

            if (i == -1) {
                // Have to see if the last few characters are a code that's been cut-off.
                if (string.search(part_regexp) != -1) {
                    pre_pend = string;
                    string = '';
                }
                else {
                    output_characters(i);
                }
            }
            else if ( i > 0) {
                output_characters(i);
            }
            else if (i == 0) {
                handle_esc();
            }
        }

        var dp = (new Date()).valueOf();
        console.log('Processing ' + index + ' took ' + (dp-d) + ' milliseconds.');

        if (should_print || cursor.show) {
            if (cursor.show) {
                buffer[cursor.y - 1][cursor.x - 1] = '<span>_</span>';
                update_chars[cursor.y + '_' + cursor.x] = true;
            }

            print_buffer();            
        }

        var dpp = (new Date()).valueOf();
        console.log('Printing ' + index + ' took ' + (dpp-dp) + ' milliseconds.');
    };

    var print_frame = function(i) {
        var t = ttyrec[i];
        var s = binary.getStringAt(t.address, t.len);
        p.render_frame(s);
    };

    var next_frame =  function() {
        if (index < ttyrec.length) {
            index += 1;
            print_frame(index);
        }
    };

    var play_data = function() {
        next_frame();
        var current = ttyrec[index];
        var next = ttyrec[index + 1];

        var millisec;
        if (current.sec == next.sec) millisec = (next.usec - current.usec)/1000;
        else if (next.sec > current.sec) {
            millisec = ((next.sec - current.sec - 1) * 1000 + 
                        ((1000000 - current.usec) + next.usec)/1000);
        }
        else {
            console.error('Frame ' + (index + 1) + 
                          'reports an earlier time than frame ' + index);
            millisec = 0;
        }

        ////////////////////////////////////
        // NOTE: Remove the following line!
        ////////////////////////////////////
        millisec = 0;

        console.log('Wait ' + millisec + ' milliseconds.');

        timeout = window.setTimeout(play_data, millisec);
    };

    var stop_data = function() {
        window.clearTimeout(timeout);
    };

    return {
        clear_frame: function() {
            buffer = [[]];
            cursor = { x:1, y: 1};
            render_frame('');
        },

        print_frame: print_frame,

        next_frame: next_frame,

        previous_frame: function() {
            if (index > 0) {
                index -= 1;
                print_frame(index);
            }
        },

        set_frame: function(n) {
            index = n;
            print_frame(index);
        },

        parse_data: function (input) {
            binary = input.binaryResponse;
            ttyrec = [];

            var length = binary.getLength();
            var offset = 0;

            while (offset < length) {
                var sec = binary.getLongAt(offset + 0, false);
                var usec = binary.getLongAt(offset + 4, false);
                var len = binary.getLongAt(offset + 8, false);
                var address = offset + 12;

                ttyrec.push(
                    { 
                        sec: sec,
                        usec: usec,
                        len: len,
                        address: address
                    });

                offset += (12 + len);
            }
        },

        play_data: play_data,

        stop_data: stop_data,

        render_frame: render_frame
    };
};

var p;

$().ready(
    function() {
        p = TTYPlayer();
        BinaryAjax('foo.ttyrec', 
                   function (data) { 
                       p.parse_data(data); 
                       p.set_frame(5);
                       p.play_data();
                   });
    });

$('html').keydown(
    function(event) {
        if (event.keyCode == '37') {
            p.previous_frame();
        }
        else if (event.keyCode == '39') {
            p.next_frame();
        }
        else if  (event.keyCode == '32') {
            p.stop_data();
        }
    });
