/**
 * datepicker.js - MooTools Datepicker class
 * @version 1.16
 *
 * by MonkeyPhysics.com
 *
 * Source/Documentation available at:
 * http://www.monkeyphysics.com/mootools/script/2/datepicker
 *
 * --
 *
 * Smoothly animating, very configurable and easy to install.
 * No Ajax, pure Javascript. 4 skins available out of the box.
 *
 * --
 *
 * Some Rights Reserved
 * http://creativecommons.org/licenses/by-sa/3.0/
 *
 */

var DatePicker = new Class({

	Implements: [Options, Events],

	// working date, which we will keep modifying to render the calendars
	d: '',

	// just so that we need not request it over and over
	today: '',

	// current user-choice in date object format
	choice: {},

	// size of body, used to animate the sliding
	bodysize: {},

	// to check availability of next/previous buttons
	limit: {},

	// element references:
	attachTo: null,    // selector for target inputs
	picker: null,      // main datepicker container
	slider: null,      // slider that contains both oldContents and newContents, used to animate between 2 different views
	oldContents: null, // used in animating from-view to new-view
	newContents: null, // used in animating from-view to new-view
	input: null,       // original input element (used for input/output)
	visual: null,      // visible input (used for rendering)

	options: {
		pickerClass: 'datepicker',
		text: {
			days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
			shortDays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
			months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
			shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
			timePrompt: 'Select a time',
			okButton: 'OK'
		},

		startDay: 1, // Sunday (0) through Saturday (6) - be aware that this may affect your layout, since the days on the right might have a different margin
		timePicker: false,
		timePickerOnly: false,
		yearPicker: true,
		yearsPerPage: 20,
		format: 'd-m-Y',
		allowEmpty: false,
		inputOutputFormat: 'U', // default to unix timestamp
		animationDuration: 400,
		useFadeInOut: !Browser.ie, // dont animate fade-in/fade-out for IE
		startView: 'month', // allowed values: {time, month, year, decades}
		positionOffset: { x: 0, y: 0 },
		minDate: null, // { date: '[date-string]', format: '[date-string-interpretation-format]' }
		maxDate: null, // same as minDate
		debug: false,
		toggleElements: null
	},

	initialize: function(attachTo, options) {
		this.attachTo = attachTo;
		this.setOptions(options).attach();

		var opt = this.options;

		// for BC
		if (!!opt.days) { opt.text.days = opt.days; }
		if (!!opt.months) { opt.text.days = opt.months; }
		if (!!opt.dayShort) { opt.text.shortDays = opt.text.days.map(function (t) { return t.substring(0, opt.dayShort); }); }
		if (!!opt.monthShort) { opt.text.shortMonths = opt.text.months.map(function (t) { return t.substring(0, opt.monthShort); }); }

		if (opt.timePickerOnly) {
			opt.timePicker = true;
			opt.startView = 'time';
		}

		this.formatMinMaxDates();

		document.addEvent('mousedown', this.close.bind(this));
	},

	formatMinMaxDates: function() {
		var opt = this.options;

		if (opt.minDate && opt.minDate.format) {
			opt.minDate = this.unformat(opt.minDate.date, opt.minDate.format);
		}
		if (opt.maxDate && opt.maxDate.format) {
			opt.maxDate = this.unformat(opt.maxDate.date, opt.maxDate.format);
			opt.maxDate.setHours(23);
			opt.maxDate.setMinutes(59);
			opt.maxDate.setSeconds(59);
		}
	},

	attach: function() {
		var opt = this.options,
			togglers;

		// toggle the datepicker through a separate element?
		if (!!opt.toggleElements) {
			togglers = $$(opt.toggleElements);
			document.addEvent('keydown', function(e) {
				if (e.key == "tab") { this.close(null, true); }
			}.bind(this));
		};

		// attach functionality to the inputs
		$$(this.attachTo).each(function(item, index) {
			// never double attach
			if (item.retrieve('datepicker')) return;

			var init_clone_val = opt.allowEmpty ? '' : this.format(new Date(), opt.format),
				display = item.getStyle('display'),
				clone;

			// determine starting value(s)
			if (!!item.get('value')) {
				init_clone_val = this.format(this.unformat(item.get('value'), opt.inputOutputFormat), opt.format);
			}

			// create clone
			clone = item
					.setStyle('display', opt.debug ? display : 'none')
					.store('datepicker', true) // to prevent double attachment...
					.clone()
					.store('datepicker', true) // ...even for the clone (!)
					.removeProperty('name')    // secure clean (form)submission
					.setStyle('display', display)
					.set('value', init_clone_val)
					.inject(item, 'after');

			// events
			if (!!opt.toggleElements) {
				togglers[index]
					.setStyle('cursor', 'pointer')
					.addEvent('click', function(e) { this.onFocus(item, clone); }.bind(this));
				clone.addEvent('blur', function() { item.set('value', clone.get('value')); });
			} else {
				clone.addEvents({
					'keydown': function(e) {
						if (opt.allowEmpty && (e.key == "delete" || e.key == "backspace")) {
							item.set('value', '');
							e.target.set('value', '');
							this.close(null, true);
						} else if (e.key == "tab") {
							this.close(null, true);
						} else {
							e.stop();
						}
					}.bind(this),
					'focus': function(e) {
						this.onFocus(item, clone);
					}.bind(this)
				});
			}
		}, this);
	},

	onFocus: function(original_input, visual_input) {
		var init_visual_date,
			d = visual_input.getCoordinates()
			opt = this.options;

		if (!!original_input.get('value')) {
			init_visual_date = this.unformat(original_input.get('value'), opt.inputOutputFormat).valueOf();
		} else {
			init_visual_date = new Date();
			if (!!opt.maxDate && init_visual_date.valueOf() > opt.maxDate.valueOf()) {
				init_visual_date.setTime(opt.maxDate.getTime());
			}
			if (!!opt.minDate && init_visual_date.valueOf() < opt.minDate.valueOf()) {
				init_visual_date.setTime(opt.minDate.getTime());
			}
		}

		this.input = original_input;
		this.show({ left: d.left + opt.positionOffset.x, top: d.top + d.height + opt.positionOffset.y }, init_visual_date);
		this.visual = visual_input;
		this.fireEvent('show');
	},

	dateToObject: function(d) {
		return {
			year: d.getFullYear(),
			month: d.getMonth(),
			day: d.getDate(),
			hours: d.getHours(),
			minutes: d.getMinutes(),
			seconds: d.getSeconds()
		};
	},

	objectToDate: function(values) {
		var d = Object.merge(this.dateToObject(new Date()), values);

		return new Date(d.year, d.month, d.day, d.hours, d.minutes, d.seconds);
	},

	show: function(position, timestamp) {
		this.formatMinMaxDates();
		this.d = !!timestamp ? new Date(timestamp) : new Date();

		this.today = new Date();
		this.choice = this.dateToObject(this.d);
		this.mode = (this.options.startView == 'time' && !this.options.timePicker) ? 'month' : this.options.startView;
		this.render();
		this.picker.setStyles(position);
	},

	render: function(fx) {
		if (!this.mode) { this.mode = 'month'; }

		var startDate = new Date(this.d.getTime()),
			renderer = 'render' + this.mode.toLowerCase().capitalize(),
			o;

		if (!this.picker) {
			this.constructPicker();
		} else {
			// swap contents so we can fill the newContents again and animate
			o = this.oldContents;
			this.oldContents = this.newContents;
			this.newContents = o;
			this.newContents.empty();
		}

		// intially assume both left and right are allowed
		this.limit = { right: false, left: false };

		if (typeof this[renderer] != 'function') {
			renderer = 'renderMonth';
		}

		// render! booty!
		this[renderer]();

		this.picker.getElement('.previous').setStyle('visibility', this.limit.left ? 'hidden' : 'visible');
		this.picker.getElement('.next').setStyle('visibility', this.limit.right ? 'hidden' : 'visible');
		this.picker.getElement('.titleText').setStyle('cursor', this.allowZoomOut() ? 'pointer' : 'default');

		// restore working date
		this.d = startDate;

		// if ever the opacity is set to '0' it was only to have us fade it in here
		// refer to the constructPicker() function, which instantiates the picker at opacity 0 when fading is desired
		if (this.picker.getStyle('opacity') == 0) {
			this.picker.tween('opacity', 0, 1);
		}

		// animate
		if (!!fx) this.fx(fx);
	},

	fx: function(fx) {
		if (fx == 'right') {
			this.oldContents.setStyles({ left: 0, opacity: 1 });
			this.newContents.setStyles({ left: this.bodysize.x, opacity: 1 });
			this.slider.setStyle('left', 0).tween('left', 0, -this.bodysize.x);
		} else if (fx == 'left') {
			this.oldContents.setStyles({ left: this.bodysize.x, opacity: 1 });
			this.newContents.setStyles({ left: 0, opacity: 1 });
			this.slider.setStyle('left', -this.bodysize.x).tween('left', -this.bodysize.x, 0);
		} else if (fx == 'fade') {
			this.slider.setStyle('left', 0);

			this.oldContents
				.setStyle('left', 0)
				.set('tween', {
					duration: this.options.animationDuration / 2,
					onComplete: function () { this.element.setStyle('z-index', 0); }
				})
				.tween('opacity', 1, 0);
			this.newContents
				.setStyles({opacity: 0, left: 0})
				.set('tween', {
					duration: this.options.animationDuration,
					onComplete: function () { this.element.setStyle('z-index', 1); }
				})
				.tween('opacity', 0, 1);
		}
	},

	constructPicker: function() {
		this.picker = new Element('div.' + this.options.pickerClass);

		if (this.options.useFadeInOut) {
			this.picker
				.setStyle('opacity', 0)
				.set('tween', {duration: this.options.animationDuration});
		}

		var h = new Element('div.header').inject(this.picker),
			titlecontainer = new Element('div.title').inject(h),
			b = new Element('div.body').inject(this.picker);

		new Element('div.previous[text=«]')
			.addEvent('click', this.previous.bind(this))
			.inject(h);

		new Element('div.next[text=»]')
			.addEvent('click', this.next.bind(this))
			.inject(h);

		new Element('div.closeButton[text=x]')
			.addEvent('click', this.close.bindWithEvent(this, true))
			.inject(h);

		new Element('span.titleText')
			.addEvent('click', this.zoomOut.bind(this))
			.inject(titlecontainer);

		this.picker.inject(document.body);

		this.bodysize = b.getSize();
		this.slider = new Element('div', {styles: {position: 'absolute', top: 0, left: 0, width: 2 * this.bodysize.x, height: this.bodysize.y }})
					.set('tween', { duration: this.options.animationDuration, transition: Fx.Transitions.Quad.easeInOut })
					.inject(b);

		this.oldContents = new Element('div', { styles: { position: 'absolute', top: 0, left: this.bodysize.x, width: this.bodysize.x, height: this.bodysize.y }}).inject(this.slider);
		this.newContents = new Element('div', { styles: { position: 'absolute', top: 0, left: 0, width: this.bodysize.x, height: this.bodysize.y }}).inject(this.slider);
	},

	renderTime: function() {
		var container = new Element('div.time'),
			generateWheel = function (min, max, wrap) {
								return function (e) {
									var t = e.target, v = t.get('value').toInt();
									t.focus();
									v += (e.wheel > 0) ? 1 : -1;
									v = (v > max) ? (wrap ? min : max) : v;
									v = (v < min) ? (wrap ? max : min) : v;
									t.set('value', v < 10 ? '0' + v : v);
									e.stop()
								};
							};

		// No next or previous for time.
		this.limit.left = this.limit.right = true;

		this.picker.getElement('.titleText')
			.set('text', this.options.timePickerOnly ? this.options.text.timePrompt : this.format(this.d, 'j M, Y'));

		new Element('input.hour[type=text]')
			.set('value', this.leadZero(this.d.getHours()))
			.addEvents({ mousewheel: generateWheel(0, 23, true) })
			.set('maxlength', 2)
			.inject(container);

		new Element('input.minutes[type=text]')
			.set('value', this.leadZero(this.d.getMinutes()))
			.addEvents({ mousewheel: generateWheel(0, 59, true) })
			.set('maxlength', 2)
			.inject(container);

		new Element('div.separator[text=":"]').inject(container);

		new Element('input.ok[type=submit]', {value: this.options.text.okButton})
			.addEvent('click', function(e) {
					e.stop();
					var d = this.dateToObject(this.d);
					d.hours = this.picker.getElement('.hour').get('value').toInt();
					d.minutes = this.picker.getElement('.minutes').get('value').toInt();
					this.select(d);
				}.bind(this)
			)
			.set('maxlength', 2)
			.inject(container);

		container.inject(this.newContents);
	},

	renderMonth: function() {
		var opt = this.options,
			month = this.d.getMonth(),
			next = new Date(this.d.valueOf()),
			prev = new Date(this.d.valueOf()),
			container = new Element('div.days'),
			titles = new Element('div.titles').inject(container),
			t = this.today.toDateString(),
			currentChoice = this.objectToDate(this.choice).toDateString(),
			d, i, classes, e, weekcontainer;

		next.setDate(1);
		next.setMonth(next.getMonth() + 1);
		this.limit.right = this.limited('date', next);

		prev.setDate(0); // Tricky way to set to the last day of the previous month.
		this.limit.left = this.limited('date', prev);

		this.picker.getElement('.titleText').set('text', this.format(this.d, 'F Y'));

		this.d.setDate(1);
		while (this.d.getDay() != opt.startDay) {
			this.d.setDate(this.d.getDate() - 1);
		}

		for (d = opt.startDay; d < (opt.startDay + 7); d++) {
			new Element('div.title.day.day' + (d % 7)).set('text', opt.text.shortDays[d % 7]).inject(titles);
		}

		for (i = 0; i < 42; i++) {
			classes = ['day', 'day'+this.d.getDay()];
			if (this.d.toDateString() == t) classes.push('today');
			if (this.d.toDateString() == currentChoice) classes.push('selected');
			if (this.d.getMonth() != month) classes.push('otherMonth');

			if (i % 7 == 0) {
				weekcontainer = new Element('div.week.week' + Math.floor(i/7)).inject(container);
			}

			if (this.limited('date')) {
				classes.push('unavailable');
				e = function () {};
			} else {
				e = (function (d) {
					return opt.timePicker ? function (e) {
						this.d.setDate(d.day);
						this.d.setMonth(d.month);
						this.mode = 'time';
						this.render('fade');
					} : function (d) { this.select(d); };
				}(this.dateToObject(this.d)));
			}

			new Element('div.' + classes.join('.') + '[text=' + this.d.getDate() + ']')
				.addEvent('click', e.bind(this))
				.inject(weekcontainer);

			this.d.setDate(this.d.getDate() + 1);
		}

		container.inject(this.newContents);
	},

	renderYear: function() {
		var opt = this.options,
			month = this.today.getMonth(),
			next = new Date(this.d.valueOf()),
			prev = new Date(this.d.valueOf()),
			thisyear = this.d.getFullYear() == this.today.getFullYear(),
			selectedyear = this.d.getFullYear() == this.choice.year,
			container = new Element('div.months'),
			i, e, classes;

		next.setDate(1);
		next.setMonth(0);
		next.setFullYear(next.getFullYear() + 1);
		this.limit.right = this.limited('month', next);

		prev.setFullYear(next.getFullYear() + 1);
		prev.setMonth(12);
		prev.setDate(31);
		this.limit.left = this.limited('month', prev);

		this.picker.getElement('.titleText').set('text', this.d.getFullYear());
		this.d.setMonth(0);

		for (i = 0; i <= 11; i++) {
			this.d.setMonth(i);

			classes = ['month', 'month' + (i + 1)];
			if (i == month && thisyear) classes.push('today');
			if (i == this.choice.month && selectedyear) classes.push('selected');

			if (this.limited('month')) {
				classes.push('unavailable');
				e = function () {};
			} else {
				e = (function (m) {
					return function (e) {
						this.d.setDate(1);
						this.d.setMonth(m);
						this.mode = 'month';
						this.render('fade');
					};
				}(i));
			}

			new Element('div.' + classes.join('.'))
				.set('text', opt.text[opt.monthShort ? 'shortMonths' : 'months'][i])
				.addEvent('click', e.bind(this))
				.inject(container);
		}

		container.inject(this.newContents);
	},

	renderDecades: function() {
		var opt = this.options,
			container = new Element('div.years'),
			next, prev,
			i, y, e, classes;

		// start neatly at interval (eg. 1980 instead of 1987)
		while (this.d.getFullYear() % opt.yearsPerPage > 0) {
			this.d.setFullYear(this.d.getFullYear() - 1);
		}

		prev = new Date(this.d.valueOf());
		prev.setFullYear(prev.getFullYear() - 1);
		this.limit.left = this.limited('year', prev);

		next = new Date(this.d.valueOf());
		next.setFullYear(next.getFullYear() + opt.yearsPerPage);
		this.limit.right = this.limited('year', next);

		this.picker.getElement('.titleText').set('text', this.d.getFullYear() + '-' + (this.d.getFullYear() + opt.yearsPerPage - 1));

		for (i = 0; i < opt.yearsPerPage; i++) {
			classes = ['year', 'year' + i];

			y = this.d.getFullYear();
			if (y == this.today.getFullYear()) { classes.push('today'); }
			if (y == this.choice.year) { classes.push('selected'); }

			if (this.limited('year')) {
				classes.push('unavailable');
				e = function() {};
			} else {
				e = (function (d) {
					return function (e) {
						this.d.setFullYear(d);
						this.mode = 'year';
						this.render('fade');
					};
				}(y));
			}

			new Element('div.' + classes.join('.') + '[text=' + y + ']')
				.addEvent('click', e.bind(this))
				.inject(container);

			this.d.setFullYear(this.d.getFullYear() + 1);
		}

		container.inject(this.newContents);
	},

	limited: function(type, d) {
		var opt = this.options,
			cs = !!opt.minDate,
			ce = !!opt.maxDate,
			t;

		if (!cs && !ce) return false;

		d = !!d ? d : this.d;

		switch (type) {
			case 'year':
				t = d.getFullYear();
				return (cs && t < opt.minDate.getFullYear()) ||
					(ce && t > opt.maxDate.getFullYear());

			case 'month':
				t = this.format(d, 'Ym');
				return (cs && t < this.format(opt.minDate, 'Ym')) ||
					(ce && t > this.format(opt.maxDate, 'Ym'));

			case 'date':
				return (cs && d < opt.minDate) || (ce && d > opt.maxDate);
		}
	},

	allowZoomOut: function() {
		if (this.mode == 'time') return !this.options.timePickerOnly;
		if (this.mode == 'decades') return false;
		if (this.mode == 'year') return !!this.options.yearPicker;
		return true;
	},

	zoomOut: function() {
		if (!this.allowZoomOut()) return;
		if (this.mode == 'year') {
			this.mode = 'decades';
		} else if (this.mode == 'time') {
			this.mode = 'month';
		} else {
			this.mode = 'year';
		}
		this.render('fade');
	},

	previous: function() {
		if (this.mode == 'decades') {
			this.d.setFullYear(this.d.getFullYear() - this.options.yearsPerPage);
		} else if (this.mode == 'year') {
			this.d.setFullYear(this.d.getFullYear() - 1);
		} else if (this.mode == 'month') {
			this.d.setMonth(this.d.getMonth() - 1);
		}
		this.render('left');
	},

	next: function() {
		if (this.mode == 'decades') {
			this.d.setFullYear(this.d.getFullYear() + this.options.yearsPerPage);
		} else if (this.mode == 'year') {
			this.d.setFullYear(this.d.getFullYear() + 1);
		} else if (this.mode == 'month') {
			// Have to set the date to 1 first
			// Because January 31 + 1 month is not February 31 it's March 3.
			this.d.setDate(1);
			this.d.setMonth(this.d.getMonth() + 1);
		}
		this.render('right');
	},

	close: function(e, force) {
		if (!$(this.picker)) return;

		var clickOutside = (!!e && e.target != this.picker && !this.picker.hasChild(e.target) && e.target != this.visual);
		if (force || clickOutside) {
			if (this.options.useFadeInOut) {
				this.picker.set('tween', { duration: this.options.animationDuration / 2, onComplete: this.destroy.bind(this) }).tween('opacity', 1, 0);
			} else {
				this.destroy();
			}
		}
	},

	destroy: function() {
		this.picker.destroy();
		this.picker = null;
		this.fireEvent('close');
	},

	select: function(values) {
		Object.append(this.choice, values);
		var d = this.objectToDate(this.choice);
		this.input.set('value', this.format(d, this.options.inputOutputFormat));
		this.visual.set('value', this.format(d, this.options.format));
		this.fireEvent('select', d);
		this.close(null, true);
	},

	leadZero: function(v) {
		return v < 10 ? '0'+v : v;
	},

	format: function(t, format) {
		var opt = this.options,
			h = t.getHours(),
			m = t.getMonth(),
			f = '',
			i;

		for (i = 0; i < format.length; i++) {
			switch(format.charAt(i)) {
				case '\\': i++; f+= format.charAt(i); break;
				case 'y': f += (100 + t.getYear() + '').substring(1); break
				case 'Y': f += t.getFullYear(); break;
				case 'm': f += this.leadZero(m + 1); break;
				case 'n': f += (m + 1); break;
				case 'M': f += opt.text.shortMonths[m]; break;
				case 'F': f += opt.text.months[m]; break;
				case 'd': f += this.leadZero(t.getDate()); break;
				case 'j': f += t.getDate(); break;
				case 'D': f += opt.text.shortDays[t.getDay()]; break;
				case 'l': f += opt.text.days[t.getDay()]; break;
				case 'G': f += h; break;
				case 'H': f += this.leadZero(h); break;
				case 'g': f += (h % 12 ? h % 12 : 12); break;
				case 'h': f += this.leadZero(h % 12 ? h % 12 : 12); break;
				case 'a': f += (h > 11 ? 'pm' : 'am'); break;
				case 'A': f += (h > 11 ? 'PM' : 'AM'); break;
				case 'i': f += this.leadZero(t.getMinutes()); break;
				case 's': f += this.leadZero(t.getSeconds()); break;
				case 'U': f += Math.floor(t.valueOf() / 1000); break;
				default:  f += format.charAt(i);
			}
		}
		return f;
	},

	// This may fail in rare cases with certain weird formats
	// Such as, if numeric values are placed ajacent to one another
	// It seems to be nearly foolproof though
	unformat: function(t, format) {
		var opt = this.options,
			a = {},
			d = {},
			esc = function (s) { return s.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); },
			c, m, i, v, r;

		t = t.toString();

		for (i = 0; i < format.length; i++) {
			c = format.charAt(i);

			if (c == '\\') {
				i++;
				r = null;
			} else {
				r = this.regexForChar(i, format);
			}

			if (!!r) {
				m = t.match('^'+r);
				if (!!m) {
					a[c] = m[1];
					t = t.substring(a[c].length);
				} else {
					if (opt.debug) alert("Fatal Error in DatePicker\n\nUnexpected format at: '"+t+"' expected format character '"+c+"' (pattern '"+r+"')");
					return new Date;
				}
			} else {
				t = t.substring(1);
			}
		}

		// If we have a timestamp, that's all we need.
		if (!!a['U']) { return new Date(+a['U'] * 1000); }

		if (!!a['Y']) {
			d.year = +a['Y'];
		} else if (!!a['y']) {
			d.year = +a['y'];
			d.year += d.year < 30 ? 2000 : 1900;
		}

		v = a['m'] || a['n'];
		if (!!v || v === 0) {
			d.month = v - 1;
		} else if (!!a['M']) {
			d.month = opt.text.shortMonths.indexOf(v);
		} else if (!!a['F']) {
			d.month = opt.text.months.indexOf(v);
		}

		v = a['d'] || a['j'];
		if (!!v || v === 0) {
			d.day = +v;
		}

		v = a['G'] || a['H'];
		if (!!v || v === 0) {
			d.hours = +v;
		}

		v = a['g'] || a['h'];
		if (!!v || v === 0) {
			d.hours = +v;
			if ((a['a'] || a['A']) && (a['g'] || a['h']).toLowerCase() == 'pm') {
				d.hours += 12;
			}
		}

		if (!!a['i']) {
			d.minutes = +a['i'];
		}

		if (!!a['s']) {
			d.seconds = +a['s'];
		}

		return this.objectToDate(d);
	},

	// This gets a little complicated for 'U' but it's necessary for extremely crazy formats
	regexForChar: function (i, format, head) {
		var next = null, ii = 0;
		switch(format.charAt(i)) {
			case head: return '(\\1)'; // special case, backreference to the first group
			case 'y': return '([0-9]{2})';
			case 'Y': return '([0-9]{4})';
			case 'm': return '(0[1-9]|1[012])';
			case 'n': return '([1-9]|1[012])';
			case 'M': return '(' + opt.text.shortMonths.map(esc).join('|') + ')';
			case 'F': return '(' + opt.text.months.map(esc).join('|') + ')';
			case 'd': return '(0[1-9]|[12][0-9]|3[01])';
			case 'j': return '([1-9]|[12][0-9]|3[01])';
			case 'D': return '(' + opt.text.shortDays.map(esc).join('|') + ')';
			case 'l': return '(' + opt.text.days.map(esc).join('|') + ')';
			case 'G': return '([0-9]|[1][0-9]|2[0-3])';
			case 'H': return '([01][0-9]|2[0-3])';
			case 'g': return '([1-9]|1[0-2])';
			case 'h': return '(0[1-9]|1[0-2])';
			case 'a': return '(am|pm)';
			case 'A': return '(AM|PM)';
			case 'i':
			case 's': return '([012345][0-9])';
			case 'U':
				var r = '(-?[0-9]+)';
				for (ii = i + 1; ii < format.length; ii++) {
					next = this.regexForChar(ii, format, 'U');
					if (next === null) {
						r += format.charAt(ii);
					} else {
						r += next;
						break;
					}
				}
				return r;
		}

		return null;
	}
});