import * as fs from "fs";
import * as path from "path";
import { parse } from 'csv-parse';
import * as log4js from 'log4js';
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
                if (ac.name === e.From) {
                    ac.account -= e.Amount;
                    ac.transactions.push(t);
                    semaphoreFrom = true;
                }
                if(ac.name == e.To) {
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
    let dataArray = JSON.parse(fs.readFileSync(filename, 'utf-8'), Entry);
    console.log(dataArray);
    return [];
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

entries = e1.concat(e2.concat(e3));

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
    if (command.split(' ')[0] !== 'List') {
        logger.error("User has input a invalid command.");
        console.log('Please enter a valid command');
    } else if (command.split(' ')[0] == "Exit") {
        logger.info("User has given EXIT command, shuttding down.");
        exit = true;
    } else {

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
    }
}   