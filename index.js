"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var log4js = require("log4js");
var fast_xml_parser_1 = require("fast-xml-parser");
// var log4js = require("log4js");
var logger = log4js.getLogger('logging.log');
log4js.configure({
    appenders: {
        file: { type: 'fileSync', filename: 'logs/debug.log' }
    },
    categories: {
        default: { appenders: ['file'], level: 'debug' }
    }
});
logger.info("Program started, logger initialised.");
var Transaction = /** @class */ (function () {
    function Transaction(date, narrative) {
        this.date = date;
        this.narrative = narrative;
    }
    Transaction.prototype.toString = function () {
        return this.date + " " + this.narrative + "\n";
    };
    return Transaction;
}());
var Person = /** @class */ (function () {
    function Person(personName) {
        this.account = 0;
        this.transactions = [];
        this.name = personName;
    }
    Person.prototype.toString = function () {
        var res = this.name + "\n";
        for (var i = 1; i <= this.transactions.length; i++) {
            res += String(i) + ". " + this.transactions[i - 1];
        }
        return res;
    };
    return Person;
}());
var Entry = /** @class */ (function () {
    function Entry(date, from, to, narrative, amount) {
        this.Date = date;
        this.From = from;
        this.To = to;
        this.Narrative = narrative;
        this.Amount = amount;
    }
    return Entry;
}());
function VerifyDate(date) {
    if (date.length != 10)
        return false;
    var day = date.slice(0, 2);
    var month = date.slice(3, 5);
    if (Number(day) > 31 || Number(day) < 1 || Number(month) > 12 || Number(month) < 1)
        return false;
    return true;
}
function VerifyNameFormat(name) {
    if (name.split(' ').length == 2 && name.split(' ')[1].length == 1)
        return true;
    return false;
}
function ReadCSV(filename) {
    var entries = [];
    try {
        var csvFilePath = path.resolve(__dirname, filename);
        var fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
        for (var _i = 0, _a = fileContent.split('\n'); _i < _a.length; _i++) {
            var line = _a[_i];
            var list = line.split(',');
            if (list.length > 1 && VerifyDate(list[0]) && VerifyNameFormat(list[1]) && VerifyNameFormat(list[2])) {
                var e = new Entry(list[0], list[1], list[2], list[3], Number(list[4]));
                entries.push(e);
            }
            else {
                logger.error("Found invalid entry, skipping...");
            }
        }
        console.log(entries.length);
        return entries;
    }
    catch (e) {
        console.log("File not found.");
        return [];
    }
}
function VerifyUniqueTransaction(account, transaction) {
    for (var _i = 0, _a = account.transactions; _i < _a.length; _i++) {
        var t = _a[_i];
        if (t.narrative === transaction.narrative && t.date === transaction.date)
            return false;
    }
    return true;
}
function UpdateAccounts(entries) {
    var accounts = [];
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var e = entries_1[_i];
        var t = new Transaction(e.Date, e.Narrative);
        var semaphoreFrom = false;
        var semaphoreTo = false;
        for (var _a = 0, accounts_3 = accounts; _a < accounts_3.length; _a++) {
            var ac = accounts_3[_a];
            if (semaphoreFrom && semaphoreTo)
                break;
            else {
                if (ac.name === e.From && VerifyUniqueTransaction(ac, t)) {
                    ac.account -= e.Amount;
                    ac.transactions.push(t);
                    semaphoreFrom = true;
                }
                if (ac.name == e.To && VerifyUniqueTransaction(ac, t)) {
                    ac.account += e.Amount;
                    ac.transactions.push(t);
                    semaphoreTo = true;
                }
            }
        }
        if (!semaphoreFrom) {
            var p = new Person(e.From);
            p.account -= e.Amount;
            p.transactions.push(t);
            accounts.push(p);
        }
        if (!semaphoreTo) {
            var p = new Person(e.To);
            p.account += e.Amount;
            p.transactions.push(t);
            accounts.push(p);
        }
    }
    return accounts;
}
function ReadJSON(filename) {
    try {
        var entries_2 = [];
        var d_1, f_1, t_1, n_1, a_1;
        JSON.parse(fs.readFileSync(filename, 'utf-8'), function (key, value) {
            // console.log(key, typeof(key), value, typeof(value));
            if (typeof (key) != typeof ([])) {
                if (key === "Date") {
                    d_1 = value;
                }
                else if (key === "FromAccount") {
                    f_1 = value;
                }
                else if (key === "ToAccount") {
                    t_1 = value;
                }
                else if (key === "Narrative") {
                    n_1 = value;
                }
                else if (key === "Amount") {
                    a_1 = Number(value);
                }
                else if (key != "") {
                    entries_2.push(new Entry(d_1, f_1, t_1, n_1, a_1));
                    // console.log(`added entry with Date: ${d}, From: ${f}, To: ${t}, Narrative: ${n} and Amount: ${a}`);
                }
            }
        });
        return entries_2;
    }
    catch (e) {
        console.log("File not found.");
        return [];
    }
}
function ConvertInterfaceToClass(interfaces) {
    var entries = [];
    for (var _i = 0, _a = interfaces["TransactionList"]["SupportTransaction"]; _i < _a.length; _i++) {
        var trans = _a[_i];
        var d = trans["@_Date"];
        var n = trans["Description"];
        var a = Number(trans["Value"]);
        var f = trans["Parties"]["From"];
        var t = trans["Parties"]["To"];
        entries.push(new Entry(d, f, t, n, a));
    }
    return entries;
}
function ReadXML(filename) {
    try {
        var xmlFilePath = path.resolve(__dirname, filename);
        var fileContent = fs.readFileSync(xmlFilePath, { encoding: 'utf-8' });
        var parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
        });
        var entryInterfaces = parser.parse(fileContent);
        return ConvertInterfaceToClass(entryInterfaces);
    }
    catch (e) {
        console.log("File not found.");
        return [];
    }
}
var entries = [];
logger.info("Starting to read Transactions2014.csv.");
var e1 = ReadCSV('Transactions2014.csv');
logger.info("Finished reading Transactions2014.csv.");
logger.info("Starting to read DodgyTransactions2015.csv.");
var e2 = ReadCSV('DodgyTransactions2015.csv');
logger.info("Finished reading DodgyTransactions2015.csv.");
logger.info("Starting to read Transactions2013.json.");
var e3 = ReadJSON('Transactions2013.json');
logger.info("Finished reading Transactions2013.json.");
logger.info("Starting to read Transactions2012.xml.");
var e4 = ReadXML('Transactions2012.xml');
logger.info("Finished reading Transactions2012.xml.");
entries = e1.concat(e2.concat(e3.concat(e4)));
console.log(entries.length);
logger.info("Starting to create account dataset.");
var accounts = UpdateAccounts(entries);
logger.info("Finished creating account dataset.");
logger.info("Database complete, receiving user input.");
var exit = false;
while (!exit) {
    var readlineSync = require('readline-sync');
    logger.info("Waiting for user input.");
    var command = readlineSync.question('');
    if (command.split(' ')[0] !== 'List' && command.split(' ')[0] !== 'Import' && command.split(' ')[0] !== 'Export') {
        logger.error("User has input a invalid command.");
        console.log('Please enter a valid command');
    }
    else if (command.split(' ')[0] == "Exit") {
        logger.info("User has given EXIT command, shuttding down.");
        exit = true;
    }
    else if (command.split(' ')[0] === 'List') {
        if (command.split(' ')[1] == 'All') {
            logger.info("User has asked for all the transactions of every account, printing...");
            console.log('Showing all transactions for all accounts');
            for (var _i = 0, accounts_1 = accounts; _i < accounts_1.length; _i++) {
                var ac = accounts_1[_i];
                console.log(ac.toString());
            }
            logger.info("Done printing all transactions for every account.");
        }
        else if (command.split(' ')[1] === undefined) {
            logger.error("User has given invalid name.");
            console.log('Please input a name');
        }
        else {
            logger.info("User has given name, starting search...");
            var pName = command.slice(command.indexOf(' ') + 1);
            var sem = false;
            for (var _a = 0, accounts_2 = accounts; _a < accounts_2.length; _a++) {
                var ac = accounts_2[_a];
                if (ac.name === pName) {
                    logger.info("Account found, printing transactions...");
                    console.log(ac.toString());
                    sem = true;
                    break;
                }
            }
            if (sem == false) {
                logger.error("Account not found.");
                console.log("Couldn't find " + pName);
            }
        }
    }
    else if (command.split(' ')[0] === 'Import') {
        if (command.split(' ')[1] != '' && command.split(' ')[1] != undefined && command.split(' ')[1] != ' ') {
            var filename = command.split(' ')[1];
            if (filename.split('.')[1] === "csv") {
                entries = entries.concat(ReadCSV(filename));
            }
            else if (filename.split('.')[1] === "json") {
                entries = entries.concat(ReadJSON(filename));
            }
            else if (filename.split('.')[1] === "xml") {
                entries = entries.concat(ReadXML(filename));
            }
            else {
                console.log("Invalid file type.");
            }
            console.log(entries.length);
        }
    }
}
// TODO: Handle file not found
// TODO: Log newer functions
