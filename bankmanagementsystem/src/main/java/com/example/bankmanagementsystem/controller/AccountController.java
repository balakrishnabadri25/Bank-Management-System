package com.example.bankmanagementsystem.controller;

import com.example.bankmanagementsystem.model.Accounts;
import com.example.bankmanagementsystem.service.AccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@CrossOrigin (origins = "http://localhost:63342/")
public class AccountController {

    @Autowired
    AccountService accservice;

    @PostMapping("/create_acc")
    public Accounts create_acc(@RequestBody Accounts account)
    {
        Accounts newacc=accservice.createacc(account);
        return newacc;
    }

    @GetMapping("/accounts")
    public List<Accounts> getaccs()
    {
        return accservice.getaccs();
    }

    @GetMapping("/balance/{acc_id}")
    public int getbalance(@PathVariable int acc_id)
    {
        Accounts account = accservice.getbalance(acc_id)
                .orElseThrow(() -> new RuntimeException("Account not found"));
        return account.getBalance();
    }

    @PostMapping("/accounts/{acc_id}/deposit")
    public String deposit(@PathVariable int acc_id,@RequestBody Accounts account)
    {
        int amount = account.getBalance();
        Accounts updated_acc=accservice.deposit(acc_id,amount);
        return "Your total balance : "+updated_acc.getBalance();
    }

    @PostMapping("/accounts/{acc_id}/withdraw")
    public String withdraw(@PathVariable int acc_id,@RequestBody Accounts account)
    {
        int amount = account.getBalance();
        Accounts updated_acc=accservice.withdraw(acc_id,amount);
        return "Your total balance : "+updated_acc.getBalance();
    }

}
