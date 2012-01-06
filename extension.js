const St = imports.gi.St;
const Main = imports.ui.main;
const Search = imports.ui.search;
const SearchDisplay = imports.ui.searchDisplay;
const IconGrid = imports.ui.iconGrid;
const GLib = imports.gi.GLib;

const MAX_SEARCH_RESULTS_ROWS = 1;
const ICON_SIZE = 81;

let calcProvider = "";

let octal = /(^|\s|[^0-9a-fA-Fxb]+)0([0-7]+)/g;
let binary = /(^|\s|[^0-9a-fA-Fxb]+)0b([0-1]+)/g;
let hex = /(^|\s|[^0-9a-fA-Fxb]+)0x([0-9a-fA-F]+)/g;

let changeBase = /in (hex|octal|binary)$/i;
let bases = {
	"hex" : 16,
	"octal" : 8,
	"binary" : 2
};
let prefixes = {
	"16" : "0x",
	"10" : "",
	"8" : "0",
	"2" : "0b"
};

function CalcResult(result) {
    this._init(result);
}

CalcResult.prototype = {
    _init: function(resultMeta) {

        this.actor = new St.Bin({ style_class: 'contact',
                                  reactive: true,
                                  track_hover: true });

        let content = new St.BoxLayout( { style_class: 'contact-content',
                                          vertical: false });
        this.actor.set_child(content);

        let icon = new St.Icon({ icon_type: St.IconType.FULLCOLOR,
                                 icon_size: ICON_SIZE,
                                 icon_name: 'accessories-calculator',
                                 style_class: 'contact-icon' });

        content.add(icon, { x_fill: true,
                            y_fill: false,
                            x_align: St.Align.START,
                            y_align: St.Align.MIDDLE });

        let result = new St.BoxLayout({ style_class: 'contact-details',
                                        vertical: true });

        content.add(result, { x_fill: true, x_align: St.Align.START });

        let exprLabel = new St.Label({ text: resultMeta.expr,
                                         style_class: 'result-expr' });
        let resultLabel = new St.Label({ text: resultMeta.result,
                                         style_class: 'result-result' });

        result.add(exprLabel, { x_fill: false, x_align: St.Align.START });
        result.add(resultLabel, { x_fill: false, x_align: St.Align.START });
    }

};

function CalcProvider() {
    this._init.apply(this, arguments);
}

CalcProvider.prototype = {
    __proto__: Search.SearchProvider.prototype,

    _init: function(title) {
        Search.SearchProvider.prototype._init.call(this, title);
    },

    _convertTable : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"],

	_toBase: function(number, base) {
		number = Math.floor(number);
		var string = "";
		var term = 1;
		while(term < number) {
			term *= base;
		}
		term /= base;
		while(term > 1) {
			string += this._convertTable[Math.floor(number / term)];
			number = number % term;
			term /= base;
		}
		string += this._convertTable[Math.floor(number)];
		if(string == "") {
			string = "0";
		}
		return string;
	},

	_validExpression: function(expression) {
		return /([0-9+\-*\/^!]|'pi')+/i.test(expression);
	},

    getInitialResultSet: function(terms) {
        let expr = terms.join(" ");
        let finalBase = 10;
        if (this._validExpression(expr)) {
			expr = expr.replace(/'pi'/gi, "\u03C0");
			expr = expr.replace(octal, "$1$2\u2088");
			expr = expr.replace(hex, "$1$2\u2081\u2086");
			expr = expr.replace(binary, "$1$2\u2082");
            if(changeBase.test(expr)) {
				finalBase = bases[changeBase.exec(expr)[1]];
				expr = expr.replace(changeBase, "");
			}
            try {
				let [success, out, err, error] = GLib.spawn_sync(null, ["gcalctool", "-s", expr], null, 4, null)
				if(error == 0) {
					let result = out.toString();
					if(finalBase != 10) {
						let neg = false;
						// \u2212 is a minus sign. Since it's unicode javascript doesn't recognize
						// the result as a negative number.
						if(result[0] == "\u2212") {
							result = result.substring(1);
							global.log(result);
							neg = true;
						}
						result = this._toBase(result, finalBase);
						result = prefixes[finalBase] + result;
						if(neg) {
							result = "\u2212" + result;
						}
					}
					return [{'expr': expr, 'result': result}];
				}
            } catch(exp) {
            }
        }

        return [];
    },

    getSubsearchResultSet: function(prevResults, terms) {
        return this.getInitialResultSet(terms);
    },

    getResultMeta: function(result) {
        return {
            'id': 0,
            'result': result.result,
            'expr': result.expr
        };
    },

    createResultActor: function(resultMeta, terms) {
        let result = new CalcResult(resultMeta);
        return result.actor;
    },

    createResultContainerActor: function() {
        let grid = new IconGrid.IconGrid({ rowLimit: MAX_SEARCH_RESULTS_ROWS,
                                           xAlign: St.Align.START });
        grid.actor.style_class = 'contact-grid';

        let actor = new SearchDisplay.GridSearchResults(this, grid);
        return actor;
    },

    activateResult: function(resultId) {
        return true;
    }
}

function init() {
    calcProvider = new CalcProvider('CALCULATOR');
}

function enable() {
    Main.overview.addSearchProvider(calcProvider);
}

function disable() {
    Main.overview.removeSearchProvider(calcProvider);
}
