-- Section 4.4.2 reference schema for the PHP/MySQL back-end (the demo site uses browser storage instead)
CREATE TABLE Users(id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(80),email VARCHAR(120) UNIQUE,phone VARCHAR(20),password VARCHAR(255),role ENUM('customer','seller','marketer','admin'));
CREATE TABLE SellerVerifications(id INT PRIMARY KEY AUTO_INCREMENT,seller_id INT,id_number VARCHAR(40),liveness_passed BOOL,status ENUM('pending','approved','rejected'));
CREATE TABLE MarketerVerifications(id INT PRIMARY KEY AUTO_INCREMENT,marketer_id INT,fee_paid DECIMAL(10,2) DEFAULT 3000,reshares_today INT DEFAULT 0,reshare_date DATE);
CREATE TABLE Products(id INT PRIMARY KEY AUTO_INCREMENT,seller_id INT,name VARCHAR(120),description TEXT,images MEDIUMTEXT COMMENT "up to 4 photos (resized JPEG data or file paths)",price DECIMAL(10,2),stock INT,category VARCHAR(40));
CREATE TABLE MarketerPool(product_id INT,marketer_id INT,proof_link VARCHAR(255),proof_link_verified BOOL DEFAULT 0,PRIMARY KEY(product_id,marketer_id));
CREATE TABLE Orders(order_id INT PRIMARY KEY AUTO_INCREMENT,customer_id INT,product_id INT,marketer_id INT NULL,quantity INT,sale_price DECIMAL(10,2),escrow_status ENUM('held','released','refunded'),order_status ENUM('pending','paid','shipped','delivered','completed'),date_created DATETIME);
CREATE TABLE Payouts(id INT PRIMARY KEY AUTO_INCREMENT,order_id INT,recipient ENUM('seller','marketer','company'),user_id INT,amount DECIMAL(10,2));
-- Accounts: every user registers as 'customer'; sellers/marketers are flags set via "Become a seller / marketer"
CREATE TABLE Withdrawals(id INT PRIMARY KEY AUTO_INCREMENT,user_id INT,amount DECIMAL(10,2),created_at DATETIME);
CREATE TABLE ContactMessages(id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(80),email VARCHAR(120),message TEXT,created_at DATETIME);
CREATE TABLE ActivityLog(id INT PRIMARY KEY AUTO_INCREMENT,kind ENUM('withdraw','payout','received'),message VARCHAR(255),created_at DATETIME);
