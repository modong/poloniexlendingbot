// vim: ts=4:sw=4:et

var localFile, reader;

var Hour = new Timespan("Hour",1/24);
var Day = new Timespan("Day",1);
var Week = new Timespan("Week",7);
var Month = new Timespan("Month",30);
var timespans = [Month, Week, Day, Hour];
var summaryCoinRate, summaryCoin;
var earningsOutputCoinRate, earningsOutputCoin;
var outputCurrencyDisplayMode = 'all'
var effRateMode = 'lentperc';

// BTC DisplayUnit
var BTC = new BTCDisplayUnit("BTC", 1);
var mBTC = new BTCDisplayUnit("mBTC", 1000);
var Bits = new BTCDisplayUnit("Bits", 1000000);
var Satoshi = new BTCDisplayUnit("Satoshi", 100000000);
var displayUnit = BTC;

function updateJson(data) {
    $('#status').text(data.last_status);
    $('#updated').text(data.last_update);

    var rowCount = data.log.length;
    var table = $('#logtable');
    table.empty();
    for (var i = rowCount - 1; i >=0; i--) {
        table.append($('<tr/>').append($('<td colspan="2" />').text(data.log[i])));
    }

    updateOutputCurrency(data.outputCurrency);
    updateRawValues(data.raw_data);
}

function updateOutputCurrency(outputCurrency){
    var OutCurr = Object.keys(outputCurrency);
    summaryCoin = outputCurrency['currency'];
    summaryCoinRate = parseFloat(outputCurrency['highestBid']);
    // switch between using outputCoin for summary only or all lending coins earnings
    if(outputCurrencyDisplayMode == 'all') {
        earningsOutputCoin = summaryCoin;
        earningsOutputCoinRate = summaryCoinRate;
    } else {
        earningsOutputCoin = 'BTC'
        earningsOutputCoinRate = 1;
    }
}

// prints a pretty float with accuracy.
// above zero accuracy will be used for float precision
// below zero accuracy will indicate precision after must significat digit
// strips trailing zeros
function prettyFloat(value, accuracy) {
    var precision = Math.round(Math.log10(value));
    var result = precision < 0 ? value.toFixed(Math.min((accuracy - precision), 8)) : value.toFixed(accuracy);
    return isNaN(result) ? '0' : result.replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}

function printFloat(value, precision) {
    var multiplier = Math.pow(10, precision);
    var result = Math.round(value * multiplier) / multiplier;
    return result = isNaN(result) ? '0' : result.toFixed(precision);
}

function updateRawValues(rawData){
    var table = document.getElementById("detailsTable");
    table.innerHTML = "";
    var currencies = Object.keys(rawData);
    var totalBTCEarnings = {};
    var totalAccountValueBTC = NaN;
    for (var keyIndex = 0; keyIndex < currencies.length; ++keyIndex)
    {
        var currency = currencies[keyIndex];
        var btcMultiplier = currency == 'BTC' ? displayUnit.multiplier : 1;
        var averageLendingRate = parseFloat(rawData[currency]['averageLendingRate']);
        var lentSum = parseFloat(rawData[currency]['lentSum']);
        var totalCoins = parseFloat(rawData[currency]['totalCoins']);
        var maxToLend = parseFloat(rawData[currency]['maxToLend']);
        var highestBidBTC = parseFloat(rawData[currency]['highestBid']);
        if (currency == 'BTC') {
            // no bids for BTC provided by poloniex
            // this is added so BTC can be handled like other coins for conversions
            highestBidBTC = 1;
            totalAccountValueBTC = parseFloat(rawData[currency]['total_account_balance']);
        }
        var couple = rawData[currency]['couple'];

        if (!isNaN(averageLendingRate) && !isNaN(lentSum) || !isNaN(totalCoins))
        {

            // cover cases where totalCoins isn't updated because all coins are lent
            if (isNaN(totalCoins) && !isNaN(lentSum)) {
                totalCoins = lentSum;
            }
            var rate = +averageLendingRate  * 0.85 / 100; // 15% goes to Poloniex fees

            var earnings = '';
            var earningsSummaryCoin = '';
            timespans.forEach(function(timespan) {
                // init totalBTCEarnings
                if (isNaN(totalBTCEarnings[timespan.name])) {
                    totalBTCEarnings[timespan.name] = 0;
                }

                // calculate coin earnings
                timespanEarning = timespan.calcEarnings(lentSum, rate);
                earnings += timespan.formatEarnings(currency, timespanEarning, true);

                // sum BTC earnings for all coins
                if(!isNaN(highestBidBTC)) {
                    timespanEarningBTC = timespan.calcEarnings(lentSum * highestBidBTC, rate);
                    totalBTCEarnings[timespan.name] += timespanEarningBTC;
                    if(currency != earningsOutputCoin) {
                        earningsSummaryCoin += timespan.formatEarnings(earningsOutputCoin, timespanEarningBTC * earningsOutputCoinRate);
                    }
                }

            });


            var effectiveRate;
            if (effRateMode == 'lentperc')
                effectiveRate = lentSum * rate * 100 / totalCoins;
            else
                effectiveRate = rate * 100;
            var yearlyRate = effectiveRate * 365; // no reinvestment
            var yearlyRateReinv = (Math.pow(effectiveRate / 100 + 1, 365) - 1) * 100; // with daily reinvestment
            var lentPerc = lentSum / totalCoins * 100;
            var lentPercLendable = lentSum / maxToLend * 100;
            function makeTooltip(title, text) {
                return '&nbsp;<a data-toggle="tooltip" class="plb-tooltip" title="' + title + '">' + text + '</a>';
            }
            var avgRateText = makeTooltip("Average loan rate, simple average calculation of active loans rates.", "Avg.");
            var effRateText;
            if (effRateMode == 'lentperc')
                effRateText = makeTooltip("Effective loan rate, considering lent precentage and poloniex 15% fee.", "Eff.");
            else
                effRateText = makeTooltip("Effective loan rate, considering poloniex 15% fee.", "Eff.");
            var compoundRateText = makeTooltip("Compound yearly rate, the result of reinvesting the interest.", "Comp.");
            var lentStr = 'Lent ' + printFloat(lentSum * btcMultiplier, 4) +' of ' + printFloat(totalCoins * btcMultiplier, 4) + ' (' + printFloat(lentPerc, 2) + '%)';

            if (totalCoins != maxToLend) {
                lentStr += ' <b>Total</b><br/>Lent ' + printFloat(lentSum * btcMultiplier, 4) + ' of ' + printFloat(maxToLend * btcMultiplier, 4) + ' (' + printFloat(lentPercLendable, 2) + '%) <b>Lendable</b>';
            }

            var displayCurrency = currency == 'BTC' ? displayUnit.name : currency;
            var currencyStr = "<b>" + displayCurrency + "</b>";
            if(!isNaN(highestBidBTC) && earningsOutputCoin != currency) {
                currencyStr += "<br/>1 "+ displayCurrency + " = " + prettyFloat(earningsOutputCoinRate * highestBidBTC / btcMultiplier , 2) + ' ' + earningsOutputCoin;
            }
            var rowValues = [currencyStr, lentStr,
                "<div class='inlinediv' >" + printFloat(averageLendingRate, 5) + '% Day' + avgRateText + '<br/>'
                    + printFloat(effectiveRate, 5) + '% Day' + effRateText + '<br/></div>'
                    + "<div class='inlinediv' >" + printFloat(yearlyRate, 2) + '% Year<br/>'
                    +  printFloat(yearlyRateReinv, 2) + '% Year' + compoundRateText + "</div>" ];

            // print coin status
            var row = table.insertRow();
            for (var i = 0; i < rowValues.length; ++i) {
                var cell = row.appendChild(document.createElement("td"));
                cell.innerHTML = rowValues[i];
                cell.style.verticalAlign = "text-top";
                if (i == 0) {
                    cell.setAttribute("width", "20%");
                }
            }
            $(row).find('[data-toggle="tooltip"]').tooltip();

            var earningsColspan = rowValues.length - 1;
            // print coin earnings
            var row = table.insertRow();
            if (lentSum > 0) {
                var cell1 = row.appendChild(document.createElement("td"));
                cell1.innerHTML = "<span class='hidden-xs'>"+ displayCurrency +"<br/></span>Estimated<br/>Earnings";
                var cell2 = row.appendChild(document.createElement("td"));
                cell2.setAttribute("colspan", earningsColspan);
                if (earningsSummaryCoin != '') {
                    cell2.innerHTML = "<div class='inlinediv' >" + earnings + "<br/></div><div class='inlinediv' style='padding-right:0px'>"+ earningsSummaryCoin + "</div>";
                } else {
                    cell2.innerHTML = "<div class='inlinediv' >" + earnings + "</div>";
                }
            }
        }
    }

    // add headers
    var thead = table.createTHead();

    // show account summary
    earnings = '';
    timespans.forEach(function(timespan) {
        earnings += timespan.formatEarnings( summaryCoin, totalBTCEarnings[timespan.name] * summaryCoinRate);
    });
    var row = thead.insertRow(0);
    var cell = row.appendChild(document.createElement("th"));
    cell.innerHTML = "Account<br/>Estimated<br/>Earnings";
    cell.style.verticalAlign = "text-top";
    cell = row.appendChild(document.createElement("th"));
    cell.style.verticalAlign = "text-top";
    cell.setAttribute("colspan", 2);
    cell.innerHTML = earnings;

    if( !isNaN(totalAccountValueBTC)) {
        // show account total balance
        var row = thead.insertRow(0);
        var cell = row.appendChild(document.createElement("th"));
        cell.innerHTML = "Account Balance";
        cell.style.verticalAlign = "text-top";
        cell = row.appendChild(document.createElement("th"));
        cell.style.verticalAlign = "text-top";
        cell.setAttribute("colspan", 2);
        cell.innerHTML =  "<div class='inlinediv' style='padding-left:0px'>"+ prettyFloat(displayUnit.multiplier * totalAccountValueBTC, 2) + " " + displayUnit.name + "</div>"
        if(summaryCoin != 'BTC') {
            cell.innerHTML +=  "<div class='inlinediv' style='padding-right:0px'>"+ prettyFloat(summaryCoinRate * totalAccountValueBTC, 2) + " " + summaryCoin + "</div>"
        }
    }

}

function handleLocalFile(file) {
    localFile = file;
    reader = new FileReader();
    reader.onload = function(e) {
        updateJson(JSON.parse(reader.result));
    };
    reader.readAsText(localFile, 'utf-8');
}

function loadData() {
    if (localFile) {
        reader.readAsText(localFile, 'utf-8');
        setTimeout('loadData()',30000)
    } else {
        // expect the botlog.json to be in the same folder on the webserver
        var file = 'botlog.json';
        $.getJSON(file, function (data) {
            updateJson(data);
            // reload every 30sec
            setTimeout('loadData()',30000)
        }).fail( function(d, textStatus, error) {
            $('#status').text("getJSON failed, status: " + textStatus + ", error: "+error);
            // retry after 60sec
            setTimeout('loadData()',60000)
        });;
    }
}

function Timespan(name, multiplier) {
    this.name = name;
    this.multiplier = multiplier;
    this.calcEarnings = function(sum, rate) {
        return sum * rate * this.multiplier;
    };
    this.formatEarnings = function(currency, earnings, minimize_currency_xs) {
        if (currency == "BTC" && this == Hour) {
            return printFloat(earnings * 100000000, 0) + " Satoshi / " + name + "<br/>";
        } else {
            var currencyClass = '';
            if (minimize_currency_xs) {
                currencyClass = 'hidden-xs';
            }
            if (currency == "BTC") {
                return displayUnit.formatValue(earnings) + " <span class=" + currencyClass + ">" + displayUnit.name + "</span> / " + name + "<br/>"
            } else {
                return printFloat(earnings, 8) + " <span class=" + currencyClass + ">" + currency + "</span> / "+  name + "<br/>";
            }
        }
    };
}

function BTCDisplayUnit(name, multiplier) {
    this.name = name;
    this.multiplier = multiplier;
    this.precision = Math.log10(multiplier);
    this.formatValue = function(value) {
        return printFloat(value * this.multiplier, 8 - this.precision);
    }
}

function setEffRateMode() {
    var validModes = ['lentperc', 'onlyfee'];
    var q = location.search.match(/[\?&]effrate=[^&]+/);

    if (q) {
        //console.log('Got effective rate mode from URI');
        effRateMode = q[0].split('=')[1];
    } else {
        if (localStorage.effRateMode) {
            //console.log('Got effective rate mode from localStorage');
            effRateMode = localStorage.effRateMode;
        }
    }
    if (validModes.indexOf(effRateMode) == -1) {
        console.error(effRateMode + ' is not valid effective rate mode! Valid values are ' + validModes);
        effRateMode = validModes[0];
    }
    localStorage.effRateMode = effRateMode;
    console.log('Effective rate mode: ' + effRateMode);
}

function setBTCDisplayUnit() {
    var validModes = [BTC, mBTC, Bits, Satoshi];
    var q = location.search.match(/[\?&]displayUnit=[^&]+/);
    var displayUnitText;

    if (q) {
        //console.log('Got displayUnitText from URI');
        displayUnitText = q[0].split('=')[1];
    } else {
        if (localStorage.displayUnitText) {
            //console.log('Got displayUnitText from localStorage');
            displayUnitText = localStorage.displayUnitText;
        }
    }
    validModes.forEach(function(unit) {
        if(unit.name == displayUnitText) {
            displayUnit = unit;
            localStorage.displayUnitText = displayUnitText;
        }
    })
    console.log('displayUnitText: ' + displayUnitText);
}

function setOutputCurrencyDisplayMode() {
    var validModes = ['all', 'summary'];
    var q = location.search.match(/[\?&]earningsInOutputCurrency=[^&]+/);
    var outputCurrencyDisplayModeText;

    if (q) {
        outputCurrencyDisplayModeText = q[0].split('=')[1];
    } else {
        if (localStorage.outputCurrencyDisplayModeText) {
            outputCurrencyDisplayModeText = localStorage.outputCurrencyDisplayModeText;
        }
    }
    validModes.forEach(function(mode) {
        if(mode == outputCurrencyDisplayModeText) {
            outputCurrencyDisplayMode = mode;
            localStorage.outputCurrencyDisplayModeText = outputCurrencyDisplayModeText;
        }
    })
    console.log('outputCurrencyDisplayMode: ' + outputCurrencyDisplayModeText);

}

$(document).ready(function () {
    setEffRateMode();
    setBTCDisplayUnit();
    setOutputCurrencyDisplayMode();
    loadData();
    if (window.location.protocol == "file:") {
        $('#file').show();
    }
});
