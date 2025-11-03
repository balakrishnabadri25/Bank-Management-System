package com.example.bankmanagementsystem.service;

import com.example.bankmanagementsystem.model.Accounts;
import com.example.bankmanagementsystem.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AccountService {

    @Autowired
    AccountRepository accrepo;

    public Accounts createacc(Accounts account) {
        return accrepo.save(account);
    }

    public List<Accounts> getaccs() {
        return accrepo.findAll();
    }

    public Optional<Accounts> getbalance(Integer accId) {
        return accrepo.findById(accId);
    }

    public Accounts deposit(int accId, int amount) {
        Accounts account = accrepo.findById(accId).orElseThrow(() -> new RuntimeException("Account not found;"));
        account.setBalance(account.getBalance()+amount);
        accrepo.save(account);
        return account;
    }

    public Accounts withdraw(int accId, int amount) {
        Accounts account = accrepo.findById(accId).orElseThrow(() -> new RuntimeException("Account not found;"));
        if(amount<= account.getBalance()) {
            account.setBalance(account.getBalance() - amount);
            accrepo.save(account);
            return account;
        }
        else throw new RuntimeException("Insufficient balance");
    }
}
