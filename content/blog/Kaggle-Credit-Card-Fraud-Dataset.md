---
title: "Fraud credit card data - EDA"
date: 2019-08-19
tags:
  - Kaggle
  - Analysis
  - Technical
draft: false
description: This article describes how I used different machine learning models to try to predict credit card fraud and see which works best.
---

This article describes how I used different machine learning models to try to predict credit card fraud and see which works best.

![creditcard image from unsplash](./images/creditcard.jpg)
*creditcard image from unsplash*

> [!warning] To the reader
> The original version of this article was written for Medium.com [here](https://medium.com/@anand.gupta1202/kaggles-credit-card-fraud-dataset-82d48b9d7cb1)
> I have attempted to export my articles here. The formatting might be off in a few places

## Motivation

Well, I am studying data science at [AAIC](https://www.appliedaicourse.com/) and as a case study, I am required to analyze and write a blog about a problem where I applied Machine Learning models to help solve the problem.

## Data Source

The data for credit card fraud case study can be found [with this link](https://www.kaggle.com/mlg-ulb/creditcardfraud). It is a Kaggle link from where you can download the data and work on it.

## Initial Findings (EDA)

After importing the necessary packages and reading the data into a pandas dataframe, we start analyzing it.

![credit card data info](./images/4o530hbq.png)
*credit card data info*

With the `info()` method we can see:

- all the columns
- all data types
- whether any columns contain null or not as its values

We can also see by the numbers written beside the names that there are *no missing data in any of the columns*.

Next up we analyse the "time" column in the dataset.

> [!note] Will update rest of the article soon
> [Back to homepage](/)
