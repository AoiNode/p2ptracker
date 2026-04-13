CREATE OR REPLACE FUNCTION trigger_refresh_monthly_summary_from_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_month_date DATE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_month_date := OLD.created_at::date;

        SELECT s.user_id
        INTO v_user_id
        FROM sessions s
        WHERE s.id = OLD.session_id;

        IF v_user_id IS NULL AND OLD.tx_id IS NOT NULL THEN
            SELECT t.user_id
            INTO v_user_id
            FROM transactions t
            WHERE t.id = OLD.tx_id;
        END IF;

        IF v_user_id IS NOT NULL THEN
            PERFORM refresh_monthly_profit_summary(v_user_id, v_month_date, FALSE);
        END IF;

        RETURN OLD;
    END IF;

    v_month_date := NEW.created_at::date;

    SELECT s.user_id
    INTO v_user_id
    FROM sessions s
    WHERE s.id = NEW.session_id;

    IF v_user_id IS NULL AND NEW.tx_id IS NOT NULL THEN
        SELECT t.user_id
        INTO v_user_id
        FROM transactions t
        WHERE t.id = NEW.tx_id;
    END IF;

    IF v_user_id IS NOT NULL THEN
        PERFORM refresh_monthly_profit_summary(v_user_id, v_month_date, FALSE);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_monthly_summary_sales ON session_sales;
CREATE TRIGGER trg_refresh_monthly_summary_sales
AFTER INSERT OR UPDATE OR DELETE ON session_sales
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_monthly_summary_from_sales();

