-- Create trigger to update user total score after userinlevel changes
DELIMITER //

CREATE TRIGGER after_userinlevel_change
AFTER INSERT OR UPDATE ON userinlevel
FOR EACH ROW
BEGIN
    -- Calculate total score for the user
    UPDATE users 
    SET Score = (
        SELECT COALESCE(SUM(EarnedScore), 0)
        FROM userinlevel
        WHERE UserId = NEW.UserId
    )
    WHERE UserId = NEW.UserId;
END//

DELIMITER ; 