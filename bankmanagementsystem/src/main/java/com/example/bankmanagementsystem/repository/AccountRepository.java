package com.example.bankmanagementsystem.repository;

import com.example.bankmanagementsystem.model.Accounts;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountRepository extends JpaRepository<Accounts,Integer> {
}
