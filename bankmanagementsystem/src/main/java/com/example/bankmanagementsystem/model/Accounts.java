package com.example.bankmanagementsystem.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
public class Accounts {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int acc_id;
    private String uname;
    private int balance;

    @Transient
    private String ifsc_code="UBIN20250912";

    public String getIfsc_code() {
        return ifsc_code;
    }

    public void setIfsc_code(String ifsc_code) {
        this.ifsc_code = ifsc_code;
    }

    public Accounts(){}

    public Accounts(String uname, int balance) {
        this.uname = uname;
        this.balance = balance;
    }

    public int getAcc_id() {
        return acc_id;
    }

    public void setAcc_id(int acc_id) {
        this.acc_id = acc_id;
    }

    public String getUname() {
        return uname;
    }

    public void setUname(String uname) {
        this.uname = uname;
    }

    public int getBalance() {
        return balance;
    }

    public void setBalance(int balance) {
        this.balance = balance;
    }
}
