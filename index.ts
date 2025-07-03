import * as fs from "fs";
import * as path from "path";
import { parse } from 'csv-parse';
import * as log4js from 'log4js';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { log } from "console";
// var log4js = require("log4js");
var logger = log4js.getLogger('logging.log');
log4js.configure({
    appenders: {
        file: { type: 'fileSync', filename: 'logs/debug.log' }
    },
    categories: {
        default: { appenders: ['file'], level: 'debug'}
    }
});

logger.info("Program started, logger initialised.");

class Transaction {
    date: string;
    narrative: string;
    constructor(date, narrative) {
        this.date = date;
        this.narrative = narrative;
    }
    toString(): string {
        return this.date + " " + this.narrative + "\n";
    }
}

class Person {
    name: string;
    account: number = 0;
    transactions: Transaction[] = [];
    constructor(personName: string) {
        this.name = personName;
    }
    toString(): string {
        let res: string = this.name + "\n";
        for (let i: number = 1; i <= this.transactions.length; i++) {
            res += String(i) + ". " + this.transactions[i - 1];
        }
        return res;
    }
}

class Entry {
    Date: string;
    From: string;
    To: string;
    Narrative: string;
    Amount: number;
    constructor(date, from, to, narrative, amount) {
        this.Date = date;
        this.From = from;
        this.To = to;
        this.Narrative = narrative;
        this.Amount = amount;
    }
}

type TEntry = {
    Date: string;
    From: string;
    To: string;
    Narrative: string;
    Amount: number;
}

function VerifyDate(date: string) : boolean {
    if (date.length != 10)
        return false;

    let day = date.slice(0, 2);
    let month = date.slice(3, 5);

    if (Number(day) > 31 || Number(day) < 1 || Number(month) > 12 || Number(month) < 1)
        return false;

    return true;
}

function VerifyNameFormat(name: string): boolean {
    if (name.split(' ').length == 2 && name.split(' ')[1].length == 1)
        return true;
    return false;
}

function ReadCSV(filename: string) : Entry[] {
    
    let entries: Entry[] = [];
    try{

        const csvFilePath: string = path.resolve(__dirname, filename);
        const fileContent: string = fs.readFileSync(csvFilePath, { encoding: 'utf-8'});

        for (let line of fileContent.split('\n')) {
            let list: string[] = line.split(',');
            if (list.length > 1 && VerifyDate(list[0]) && VerifyNameFormat(list[1]) && VerifyNameFormat(list[2])) {
                let e: Entry = new Entry(list[0], list[1], list[2], list[3], Number(list[4]));
                entries.push(e);
            } else {
                logger.error("Found invalid entry, skipping...");
            }
        }
        console.log(entries.length);
        return entries;

    } catch (e) {
        console.log("File not found.")
        return [];
    }
}

function VerifyUniqueTransaction(account: Person, transaction: Transaction): boolean {
    for (let t of account.transactions) {
        if (t.narrative === transaction.narrative && t.date === transaction.date)
            return false;
    }
    return true;
}

function UpdateAccounts(entries: Entry[]): Array<Person>{

    let accounts: Array<Person> = [];
    for (let e of entries) {
        let t: Transaction = new Transaction(e.Date, e.Narrative);
        let semaphoreFrom: boolean = false;
        let semaphoreTo:boolean = false;
        for (let ac of accounts) {
            if (semaphoreFrom && semaphoreTo)
                break;
            else {
                if (ac.name === e.From && VerifyUniqueTransaction(ac, t)) {
                    ac.account -= e.Amount;
                    ac.transactions.push(t);
                    semaphoreFrom = true;
                }
                if(ac.name == e.To && VerifyUniqueTransaction(ac, t)) {
                    ac.account += e.Amount;
                    ac.transactions.push(t);
                    semaphoreTo = true;
                }
            }
        }
        if (!semaphoreFrom) {
            let p = new Person(e.From);
            p.account -= e.Amount;
            p.transactions.push(t);
            accounts.push(p);
        }
        if (!semaphoreTo) {
            let p = new Person(e.To);
            p.account += e.Amount;
            p.transactions.push(t);
            accounts.push(p);
        }
    }

    return accounts;
}

function ReadJSON(filename: string): Entry[] {

    try {

        let entries: Entry[] = [];
        let d: string, f: string, t: string, n: string, a: number;
        JSON.parse(fs.readFileSync(filename, 'utf-8'), (key: string, value) => {
            // console.log(key, typeof(key), value, typeof(value));
            if (typeof(key) != typeof([])) {
                if (key === "Date") {
                    d = value;
                } else if (key === "FromAccount") {
                    f = value;
                } else if (key === "ToAccount") {
                    t = value;
                } else if (key === "Narrative") {
                    n = value;
                } else if (key === "Amount") {
                    a = Number(value);
                } else if (key != ""){
                    entries.push(new Entry(d, f, t, n, a));
                    // console.log(`added entry with Date: ${d}, From: ${f}, To: ${t}, Narrative: ${n} and Amount: ${a}`);
                }
            }
        });
        return entries;
    } catch (e) {
        console.log("File not found.")
        return [];
    }
}

interface EntryInterface {
    TransactionList: {
       SupportTransaction : {Description: string, Value: number, Parties: {From: string, To: string}}[];
    };
}

function ConvertInterfaceToClass(interfaces: EntryInterface[]): Entry[] {
    let entries: Entry[] = [];
    for (let trans of interfaces["TransactionList"]["SupportTransaction"]) {
        let d: string = trans["@_Date"];
        let n: string = trans["Description"];
        let a: number = Number(trans["Value"]);
        let f: string = trans["Parties"]["From"];
        let t: string = trans["Parties"]["To"];
        entries.push(new Entry(d, f, t, n, a));
    }
    return entries;
}

function ReadXML(filename: string): Entry[] {

    try {

        const xmlFilePath: string = path.resolve(__dirname, filename);
        const fileContent: string = fs.readFileSync(xmlFilePath, { encoding: 'utf-8'});
        
        const parser = new XMLParser({
            ignoreAttributes: false,
        });
        let entryInterfaces: EntryInterface[] = parser.parse(fileContent);
        return ConvertInterfaceToClass(entryInterfaces);

    } catch (e) {
        console.log("File not found.")
        return [];
    }

}

let entries: Entry[] = [];

logger.info("Starting to read Transactions2014.csv.")
let e1 = ReadCSV('Transactions2014.csv');
logger.info("Finished reading Transactions2014.csv.")

logger.info("Starting to read DodgyTransactions2015.csv.")
let e2 = ReadCSV('DodgyTransactions2015.csv');
logger.info("Finished reading DodgyTransactions2015.csv.")

logger.info("Starting to read Transactions2013.json.")
let e3 = ReadJSON('Transactions2013.json');
logger.info("Finished reading Transactions2013.json.")

logger.info("Starting to read Transactions2012.xml.")
let e4 = ReadXML('Transactions2012.xml');
logger.info("Finished reading Transactions2012.xml.")

entries = e1.concat(e2.concat(e3.concat(e4)));

console.log(entries.length);
logger.info("Starting to create account dataset.");
let accounts: Array<Person> = UpdateAccounts(entries);
logger.info("Finished creating account dataset.");


logger.info("Database complete, receiving user input.");
let exit: boolean = false;
while(!exit) {
    let readlineSync = require('readline-sync');
    logger.info("Waiting for user input.");
    let command: string = readlineSync.question('');
    if (command.split(' ')[0] !== 'List' && command.split(' ')[0] !== 'Import' && command.split(' ')[0] !== 'Export') {
        logger.error("User has input a invalid command.");
        console.log('Please enter a valid command');
    } else if (command.split(' ')[0] == "Exit") {
        logger.info("User has given EXIT command, shuttding down.");
        exit = true;
    } else if (command.split(' ')[0] === 'List') {

        if (command.split(' ')[1] == 'All') {
            logger.info("User has asked for all the transactions of every account, printing...");
            console.log('Showing all transactions for all accounts');
            for (let ac of accounts)
                console.log(ac.toString());
            logger.info("Done printing all transactions for every account.");

        } else if (command.split(' ')[1] === undefined) {
            logger.error("User has given invalid name.");
            console.log('Please input a name');
        } else {
            logger.info("User has given name, starting search...")
            let pName: string = command.slice(command.indexOf(' ') + 1);
            let sem: boolean = false;
            for (let ac of accounts) {
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
    } else if (command.split(' ')[0] === 'Import') {
        if (command.split(' ')[1] != '' && command.split(' ')[1] != undefined && command.split(' ')[1] != ' ') {
            let filename: string = command.split(' ')[1];
            if (filename.split('.')[1] === "csv") {
                entries = entries.concat(ReadCSV(filename));
            } else if (filename.split('.')[1] === "json") {
                entries = entries.concat(ReadJSON(filename));
            } else if (filename.split('.')[1] === "xml") {
                entries = entries.concat(ReadXML(filename));
            } else {
                console.log("Invalid file type.");
            }
            console.log(entries.length)
        }
    }
}   

// TODO: Log newer functions
// TODO: Add Export command handling